import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";
import { recalculateConceptMasteries } from "@/lib/progress";
import { getLearnerConceptAvailability } from "@/lib/progress";

type RouteContext = { params: Promise<{ quizId: string }> };

const updateQuizSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  passingThreshold: z.number().int().min(1).max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one quiz field is required.");

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { quizId } = await params;
  const quiz = await getPrismaClient().quiz.findFirst({
    where: {
      id: quizId,
      archivedAt: null,
      concept: {
        archivedAt: null,
        course: {
          archivedAt: null,
          ...(user.role === "INSTRUCTOR"
            ? { instructorId: user.id }
            : { enrollments: { some: { userId: user.id } } }),
        },
      },
    },
    include: {
      concept: { select: { id: true, title: true, courseId: true } },
      questions: { where: { archivedAt: null }, orderBy: { position: "asc" } },
    },
  });
  if (!quiz) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  if (user.role === "INSTRUCTOR") return NextResponse.json({ quiz });
  const availability = await getLearnerConceptAvailability(
    getPrismaClient(),
    user.id,
    quiz.conceptId,
  );
  if (!availability) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  if (availability.status === "locked") {
    return NextResponse.json({
      error: "This concept is locked until all prerequisites are mastered.",
      missingPrerequisiteTitles: availability.missingPrerequisiteTitles,
    }, { status: 403 });
  }
  return NextResponse.json({
    quiz: {
      ...quiz,
      questions: quiz.questions.map((question) => ({
        id: question.id,
        quizId: question.quizId,
        prompt: question.prompt,
        options: question.options,
        position: question.position,
      })),
    },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, updateQuizSchema);
  if ("response" in parsed) return parsed.response;
  const { quizId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      archivedAt: null,
      concept: { archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
    },
    include: { concept: { select: { id: true, title: true, courseId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

  try {
    const quiz = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.quiz.update({ where: { id: quizId }, data: parsed.data });
      if (parsed.data.passingThreshold !== undefined) {
        await recalculateConceptMasteries(transaction, existing.conceptId);
      }
      await recordCurriculumChange(transaction, {
        courseId: existing.concept.courseId,
        actorId: user.id,
        conceptId: existing.conceptId,
        kind: "QUIZ_UPDATED",
        summary: `Assessment updated: ${updated.title}. Previous attempts were preserved.`,
        beforeSnapshot: { title: existing.title, passingThreshold: existing.passingThreshold },
        afterSnapshot: { title: updated.title, passingThreshold: updated.passingThreshold },
      });
      return updated;
    });
    return NextResponse.json({ quiz });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An assessment with that title already exists." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const { quizId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      archivedAt: null,
      concept: { archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
    },
    include: { concept: { select: { id: true, title: true, courseId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

  const archivedAt = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.quiz.update({ where: { id: quizId }, data: { archivedAt } });
    await recalculateConceptMasteries(transaction, existing.conceptId);
    await recordCurriculumChange(transaction, {
      courseId: existing.concept.courseId,
      actorId: user.id,
      conceptId: existing.conceptId,
      kind: "QUIZ_ARCHIVED",
      summary: `Assessment archived: ${existing.title}. Quiz history was preserved.`,
      beforeSnapshot: { archivedAt: null },
      afterSnapshot: { archivedAt: archivedAt.toISOString() },
    });
  });
  return new NextResponse(null, { status: 204 });
}
