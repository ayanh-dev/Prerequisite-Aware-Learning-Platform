import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ quizId: string }> };

const createQuestionSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(10),
  correctOptionIndex: z.number().int().min(0).max(9),
  explanation: z.string().trim().max(4000).default(""),
  position: z.number().int().min(1).optional(),
}).strict().refine(
  (value) => value.correctOptionIndex < value.options.length,
  "The correct answer index must refer to an existing option.",
);

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, createQuestionSchema);
  if ("response" in parsed) return parsed.response;
  const { quizId } = await params;
  const prisma = getPrismaClient();
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      archivedAt: null,
      concept: { archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
    },
    include: { concept: { select: { id: true, title: true, courseId: true } } },
  });
  if (!quiz) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  const last = await prisma.question.findFirst({
    where: { quizId, archivedAt: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = parsed.data.position ?? (last?.position ?? 0) + 1;

  try {
    const question = await prisma.$transaction(async (transaction) => {
      const created = await transaction.question.create({
        data: { quizId, ...parsed.data, position },
      });
      await recordCurriculumChange(transaction, {
        courseId: quiz.concept.courseId,
        actorId: user.id,
        conceptId: quiz.conceptId,
        kind: "QUESTION_CREATED",
        summary: `A question was added to ${quiz.title} for ${quiz.concept.title}.`,
        afterSnapshot: { questionId: created.id, quizId, position },
      });
      return created;
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That question position is already in use." }, { status: 409 });
    }
    throw error;
  }
}
