import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ courseId: string }> };

const createConceptSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).default(""),
  lessonDurationMinutes: z.number().int().min(0).max(1440).default(0),
  order: z.number().int().min(1).optional(),
}).strict();

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { courseId } = await params;
  const prisma = getPrismaClient();
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      archivedAt: null,
      ...(user.role === "INSTRUCTOR"
        ? { instructorId: user.id }
        : { enrollments: { some: { userId: user.id } } }),
    },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const concepts = await prisma.concept.findMany({
    where: { courseId, archivedAt: null },
    orderBy: { order: "asc" },
    include: {
      prerequisiteLinks: {
        where: { prerequisite: { archivedAt: null } },
        include: { prerequisite: { select: { id: true, title: true } } },
      },
      lessons: { where: { archivedAt: null }, select: { id: true, title: true, durationMinutes: true, kind: true } },
      quizzes: { where: { archivedAt: null }, select: { id: true, title: true, passingThreshold: true } },
    },
  });
  return NextResponse.json({ concepts });
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, createConceptSchema);
  if ("response" in parsed) return parsed.response;

  const { courseId } = await params;
  const prisma = getPrismaClient();
  const course = await prisma.course.findFirst({
    where: { id: courseId, instructorId: user.id, archivedAt: null },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  const last = await prisma.concept.findFirst({
    where: { courseId, archivedAt: null },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = parsed.data.order ?? (last?.order ?? 0) + 1;

  try {
    const concept = await prisma.$transaction(async (transaction) => {
      const created = await transaction.concept.create({
        data: {
          courseId,
          title: parsed.data.title,
          description: parsed.data.description,
          order,
          lessonDurationMinutes: parsed.data.lessonDurationMinutes,
        },
      });
      await recordCurriculumChange(transaction, {
        courseId,
        actorId: user.id,
        conceptId: created.id,
        kind: "CONCEPT_CREATED",
        summary: `New concept added: ${created.title}.`,
        afterSnapshot: {
          id: created.id,
          title: created.title,
          description: created.description,
          order: created.order,
          lessonDurationMinutes: created.lessonDurationMinutes,
        },
      });
      return created;
    });
    return NextResponse.json({ concept }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That concept order is already in use." }, { status: 409 });
    }
    throw error;
  }
}
