import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";
import { getLearnerConceptAvailability } from "@/lib/progress";

type RouteContext = { params: Promise<{ conceptId: string }> };

const updateConceptSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  lessonDurationMinutes: z.number().int().min(0).max(1440).optional(),
  order: z.number().int().min(1).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one concept field is required.");

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
    include: {
      prerequisiteLinks: {
        where: { prerequisite: { archivedAt: null } },
        include: { prerequisite: { select: { id: true, title: true } } },
      },
      lessons: { where: { archivedAt: null }, orderBy: { createdAt: "asc" } },
      quizzes: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        include: { questions: { where: { archivedAt: null }, orderBy: { position: "asc" } } },
      },
    },
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
    return NextResponse.json({
      concept: {
        ...concept,
        quizzes: concept.quizzes.map((quiz) => ({
          ...quiz,
          questions: quiz.questions.map((question) => ({
            id: question.id,
            quizId: question.quizId,
            prompt: question.prompt,
            options: question.options,
            position: question.position,
          })),
        })),
      },
    });
  }
  return NextResponse.json({ concept });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, updateConceptSchema);
  if ("response" in parsed) return parsed.response;

  const { conceptId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.concept.findFirst({
    where: { id: conceptId, archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
  });
  if (!existing) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  try {
    const concept = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.concept.update({
        where: { id: conceptId },
        data: parsed.data,
      });
      await recordCurriculumChange(transaction, {
        courseId: existing.courseId,
        actorId: user.id,
        conceptId,
        kind: "CONCEPT_UPDATED",
        summary: `Concept updated: ${updated.title}.`,
        beforeSnapshot: {
          title: existing.title,
          description: existing.description,
          order: existing.order,
          lessonDurationMinutes: existing.lessonDurationMinutes,
        },
        afterSnapshot: {
          title: updated.title,
          description: updated.description,
          order: updated.order,
          lessonDurationMinutes: updated.lessonDurationMinutes,
        },
      });
      return updated;
    });
    return NextResponse.json({ concept });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That concept order is already in use." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const { conceptId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.concept.findFirst({
    where: { id: conceptId, archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
    select: { id: true, courseId: true, title: true },
  });
  if (!existing) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  const archivedAt = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.concept.update({
      where: { id: conceptId },
      data: { archivedAt },
    });
    await transaction.lesson.updateMany({ where: { conceptId, archivedAt: null }, data: { archivedAt } });
    await transaction.quiz.updateMany({ where: { conceptId, archivedAt: null }, data: { archivedAt } });
    await recordCurriculumChange(transaction, {
      courseId: existing.courseId,
      actorId: user.id,
      conceptId,
      kind: "CONCEPT_ARCHIVED",
      summary: `Concept archived: ${existing.title}. Existing learning history was preserved.`,
      beforeSnapshot: { archivedAt: null },
      afterSnapshot: { archivedAt: archivedAt.toISOString() },
    });
  });
  return new NextResponse(null, { status: 204 });
}
