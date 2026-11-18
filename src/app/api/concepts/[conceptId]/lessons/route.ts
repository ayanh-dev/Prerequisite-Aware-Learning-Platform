import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";
import { getLearnerConceptAvailability } from "@/lib/progress";

type RouteContext = { params: Promise<{ conceptId: string }> };

const createLessonSchema = z.object({
  title: z.string().trim().min(2).max(160),
  kind: z.enum(["TEXT", "VIDEO"]).default("TEXT"),
  content: z.string().max(50000).optional(),
  videoUrl: z.url().max(2048).optional(),
  durationMinutes: z.number().int().min(0).max(1440),
}).strict().refine(
  (value) => value.kind !== "VIDEO" || value.videoUrl !== undefined,
  "Video lessons require a video URL.",
);

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { conceptId } = await params;
  const concept = await getPrismaClient().concept.findFirst({
    where: {
      id: conceptId,
      archivedAt: null,
      course: {
        archivedAt: null,
        ...(user.role === "INSTRUCTOR"
          ? { instructorId: user.id }
          : { enrollments: { some: { userId: user.id } } }),
      },
    },
    select: { id: true },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  if (user.role === "LEARNER") {
    const availability = await getLearnerConceptAvailability(
      getPrismaClient(),
      user.id,
      conceptId,
    );
    if (!availability) return NextResponse.json({ error: "Concept not found." }, { status: 404 });
    if (availability.status === "locked") {
      return NextResponse.json({
        error: "This concept is locked until all prerequisites are mastered.",
        missingPrerequisiteTitles: availability.missingPrerequisiteTitles,
      }, { status: 403 });
    }
  }

  const lessons = await getPrismaClient().lesson.findMany({
    where: { conceptId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      progress: {
        where: { userId: user.id },
        select: { completedAt: true },
      },
    },
  });
  return NextResponse.json({
    lessons: lessons.map(({ progress, ...lesson }) => ({
      ...lesson,
      completedAt: progress[0]?.completedAt ?? null,
    })),
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, createLessonSchema);
  if ("response" in parsed) return parsed.response;

  const { conceptId } = await params;
  const prisma = getPrismaClient();
  const concept = await prisma.concept.findFirst({
    where: { id: conceptId, archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
    select: { id: true, title: true, courseId: true },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  try {
    const lesson = await prisma.$transaction(async (transaction) => {
      const created = await transaction.lesson.create({
        data: { conceptId, ...parsed.data },
      });
      await recordCurriculumChange(transaction, {
        courseId: concept.courseId,
        actorId: user.id,
        conceptId,
        kind: "LESSON_CREATED",
        summary: `New lesson added to ${concept.title}: ${created.title}.`,
        afterSnapshot: {
          id: created.id,
          title: created.title,
          kind: created.kind,
          durationMinutes: created.durationMinutes,
        },
      });
      return created;
    });
    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A lesson with that title already exists for this concept." }, { status: 409 });
    }
    throw error;
  }
}
