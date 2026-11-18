import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import { getPrismaClient } from "@/lib/prisma";
import { getLearnerConceptAvailability } from "@/lib/progress";

type RouteContext = { params: Promise<{ conceptId: string }> };

const createQuizSchema = z.object({
  title: z.string().trim().min(2).max(160),
  passingThreshold: z.number().int().min(1).max(100).default(70),
}).strict();

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

  const quizzes = await getPrismaClient().quiz.findMany({
    where: { conceptId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      questions: { where: { archivedAt: null }, orderBy: { position: "asc" } },
    },
  });
  return NextResponse.json({
    quizzes: user.role === "INSTRUCTOR"
      ? quizzes
      : quizzes.map((quiz) => ({
          ...quiz,
          questions: quiz.questions.map((question) => ({
            id: question.id,
            quizId: question.quizId,
            prompt: question.prompt,
            options: question.options,
            position: question.position,
          })),
        })),
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, createQuizSchema);
  if ("response" in parsed) return parsed.response;
  const { conceptId } = await params;
  const prisma = getPrismaClient();
  const concept = await prisma.concept.findFirst({
    where: { id: conceptId, archivedAt: null, course: { instructorId: user.id, archivedAt: null } },
    select: { id: true, title: true, courseId: true },
  });
  if (!concept) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  try {
    const quiz = await prisma.$transaction(async (transaction) => {
      const created = await transaction.quiz.create({
        data: { conceptId, ...parsed.data },
      });
      await recordCurriculumChange(transaction, {
        courseId: concept.courseId,
        actorId: user.id,
        conceptId,
        kind: "QUIZ_CREATED",
        summary: `New assessment added to ${concept.title}: ${created.title}.`,
        afterSnapshot: { id: created.id, title: created.title, passingThreshold: created.passingThreshold },
      });
      return created;
    });
    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An assessment with that title already exists." }, { status: 409 });
    }
    throw error;
  }
}
