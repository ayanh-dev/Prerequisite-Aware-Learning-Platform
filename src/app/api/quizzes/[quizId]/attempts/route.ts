import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import {
  loadLearnerCourseState,
  recalculateConceptMasteries,
  refreshStoredLearningPaths,
} from "@/lib/progress";

type RouteContext = { params: Promise<{ quizId: string }> };

const submitAttemptSchema = z.object({
  answers: z.array(z.number().int().min(0).max(9)).min(1).max(100),
}).strict();

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "LEARNER") return forbiddenResponse();
  const parsed = await parseJson(request, submitAttemptSchema);
  if ("response" in parsed) return parsed.response;
  const { quizId } = await params;
  const prisma = getPrismaClient();
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      archivedAt: null,
      concept: { archivedAt: null, course: { archivedAt: null } },
    },
    include: {
      concept: { select: { id: true, courseId: true, title: true } },
      questions: { where: { archivedAt: null }, orderBy: { position: "asc" } },
    },
  });
  if (!quiz) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  if (quiz.questions.length === 0) {
    return NextResponse.json({ error: "This assessment has no active questions." }, { status: 409 });
  }
  if (parsed.data.answers.length !== quiz.questions.length) {
    return NextResponse.json({
      error: `Submit one answer for each of the ${quiz.questions.length} active questions.`,
    }, { status: 400 });
  }

  const questionData = quiz.questions.map((question) => {
    const options: unknown = question.options;
    if (!Array.isArray(options) || !options.every((option) => typeof option === "string")) {
      throw new Error(`Question "${question.id}" has invalid stored options.`);
    }
    if (question.correctOptionIndex >= options.length) {
      throw new Error(`Question "${question.id}" has an invalid correct answer index.`);
    }
    return { ...question, options: options as string[] };
  });
  if (parsed.data.answers.some((answer, index) => answer >= questionData[index].options.length)) {
    return NextResponse.json({ error: "An answer index does not match the question options." }, { status: 400 });
  }

  const correctCount = parsed.data.answers.reduce(
    (total, answer, index) => total + Number(answer === questionData[index].correctOptionIndex),
    0,
  );
  const score = Math.round((correctCount / questionData.length) * 100);
  const passed = score >= quiz.passingThreshold;
  const result = await prisma.$transaction(async (transaction) => {
    const state = await loadLearnerCourseState(transaction, user.id, quiz.concept.courseId);
    if (!state) return { error: "You must enroll in this course before taking assessments.", status: 403 } as const;
    const unlock = state.unlockStates.find(({ conceptId }) => conceptId === quiz.concept.id);
    if (!unlock || unlock.status === "locked") {
      const missingPrerequisiteTitles = state.concepts
        .filter((concept) => unlock?.missingPrerequisiteIds.includes(concept.id))
        .map(({ title }) => title);
      return {
        error: "This concept is locked until all prerequisites are mastered.",
        status: 403,
        missingPrerequisiteTitles,
      } as const;
    }

    const attempt = await transaction.quizAttempt.create({
      data: {
        userId: user.id,
        quizId,
        score,
        passed,
        answers: parsed.data.answers,
        questionSnapshot: questionData.map((question) => ({
          prompt: question.prompt,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          explanation: question.explanation,
          position: question.position,
        })),
      },
    });
    await recalculateConceptMasteries(transaction, quiz.concept.id);
    await refreshStoredLearningPaths(transaction, quiz.concept.courseId, user.id);
    return {
      attempt: { id: attempt.id, score, passed, attemptedAt: attempt.attemptedAt },
      correctCount,
      totalQuestions: questionData.length,
      mastery: {
        conceptId: quiz.concept.id,
        mastered: passed || state.masteredConceptIds.has(quiz.concept.id),
      },
      results: questionData.map((question, index) => ({
        questionId: question.id,
        selectedOptionIndex: parsed.data.answers[index],
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation,
      })),
    } as const;
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error, ...("missingPrerequisiteTitles" in result ? { missingPrerequisiteTitles: result.missingPrerequisiteTitles } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json(result, { status: 201 });
}
