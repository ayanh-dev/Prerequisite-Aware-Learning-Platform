import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ lessonId: string }> };

const updateLessonSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  kind: z.enum(["TEXT", "VIDEO"]).optional(),
  content: z.string().max(50000).nullable().optional(),
  videoUrl: z.url().max(2048).nullable().optional(),
  durationMinutes: z.number().int().min(0).max(1440).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one lesson field is required.");

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, updateLessonSchema);
  if ("response" in parsed) return parsed.response;
  const { lessonId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      archivedAt: null,
      concept: { archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
    },
    include: { concept: { select: { title: true, courseId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  const resultingKind = parsed.data.kind ?? existing.kind;
  const resultingVideoUrl = parsed.data.videoUrl === undefined ? existing.videoUrl : parsed.data.videoUrl;
  if (resultingKind === "VIDEO" && !resultingVideoUrl) {
    return NextResponse.json({ error: "Video lessons require a video URL." }, { status: 400 });
  }

  try {
    const lesson = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.lesson.update({
        where: { id: lessonId },
        data: parsed.data,
      });
      await recordCurriculumChange(transaction, {
        courseId: existing.concept.courseId,
        actorId: user.id,
        conceptId: existing.conceptId,
        kind: "LESSON_UPDATED",
        summary: `Lesson updated in ${existing.concept.title}: ${updated.title}.`,
        beforeSnapshot: {
          title: existing.title,
          kind: existing.kind,
          durationMinutes: existing.durationMinutes,
          videoUrl: existing.videoUrl,
        },
        afterSnapshot: {
          title: updated.title,
          kind: updated.kind,
          durationMinutes: updated.durationMinutes,
          videoUrl: updated.videoUrl,
        },
      });
      return updated;
    });
    return NextResponse.json({ lesson });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A lesson with that title already exists for this concept." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const { lessonId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      archivedAt: null,
      concept: { archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
    },
    include: { concept: { select: { title: true, courseId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const archivedAt = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.lesson.update({ where: { id: lessonId }, data: { archivedAt } });
    await recordCurriculumChange(transaction, {
      courseId: existing.concept.courseId,
      actorId: user.id,
      conceptId: existing.conceptId,
      kind: "LESSON_ARCHIVED",
      summary: `Lesson archived: ${existing.title}. Completion history was preserved.`,
      beforeSnapshot: { archivedAt: null },
      afterSnapshot: { archivedAt: archivedAt.toISOString() },
    });
  });
  return new NextResponse(null, { status: 204 });
}
