import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ questionId: string }> };

const updateQuestionSchema = z.object({
  prompt: z.string().trim().min(3).max(2000).optional(),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(10).optional(),
  correctOptionIndex: z.number().int().min(0).max(9).optional(),
  explanation: z.string().trim().max(4000).optional(),
  position: z.number().int().min(1).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one question field is required.");

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, updateQuestionSchema);
  if ("response" in parsed) return parsed.response;
  const { questionId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.question.findFirst({
    where: {
      id: questionId,
      archivedAt: null,
      quiz: { archivedAt: null, concept: { archivedAt: null, course: { instructorId: user.id, archivedAt: null } } },
    },
    include: { quiz: { include: { concept: { select: { title: true, courseId: true, id: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  const options = parsed.data.options ?? existing.options;
  if (!Array.isArray(options) || !options.every((option) => typeof option === "string")) {
    throw new Error(`Question "${questionId}" has invalid stored options.`);
  }
  const correctOptionIndex = parsed.data.correctOptionIndex ?? existing.correctOptionIndex;
  if (correctOptionIndex >= options.length) {
    return NextResponse.json({ error: "The correct answer index must refer to an existing option." }, { status: 400 });
  }

  try {
    const question = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.question.update({ where: { id: questionId }, data: parsed.data });
      await recordCurriculumChange(transaction, {
        courseId: existing.quiz.concept.courseId,
        actorId: user.id,
        conceptId: existing.quiz.concept.id,
        kind: "QUESTION_UPDATED",
        summary: `A question in ${existing.quiz.title} was updated. Prior quiz results remain unchanged.`,
        beforeSnapshot: { questionId, prompt: existing.prompt, position: existing.position },
        afterSnapshot: { questionId, prompt: updated.prompt, position: updated.position },
      });
      return updated;
    });
    return NextResponse.json({ question });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That question position is already in use." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const { questionId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.question.findFirst({
    where: {
      id: questionId,
      archivedAt: null,
      quiz: { archivedAt: null, concept: { archivedAt: null, course: { instructorId: user.id, archivedAt: null } } },
    },
    include: { quiz: { include: { concept: { select: { title: true, courseId: true, id: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  const archivedAt = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.question.update({ where: { id: questionId }, data: { archivedAt } });
    await recordCurriculumChange(transaction, {
      courseId: existing.quiz.concept.courseId,
      actorId: user.id,
      conceptId: existing.quiz.concept.id,
      kind: "QUESTION_ARCHIVED",
      summary: `A question in ${existing.quiz.title} was archived; saved quiz attempts were preserved.`,
      beforeSnapshot: { archivedAt: null },
      afterSnapshot: { archivedAt: archivedAt.toISOString() },
    });
  });
  return new NextResponse(null, { status: 204 });
}
