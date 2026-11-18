import { NextResponse } from "next/server";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { getPrismaClient } from "@/lib/prisma";
import { loadLearnerCourseState } from "@/lib/progress";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "LEARNER") return forbiddenResponse();
  const { courseId } = await params;
  const prisma = getPrismaClient();
  const state = await loadLearnerCourseState(prisma, user.id, courseId);
  if (!state) return NextResponse.json({ error: "Course not found or you are not enrolled." }, { status: 404 });

  const records = await prisma.concept.findMany({
    where: { courseId, archivedAt: null },
    orderBy: { order: "asc" },
    include: {
      lessons: {
        where: { archivedAt: null },
        include: { progress: { where: { userId: user.id }, select: { completedAt: true } } },
      },
      quizzes: {
        where: { archivedAt: null },
        include: {
          attempts: {
            where: { userId: user.id },
            orderBy: { attemptedAt: "desc" },
            select: { id: true, score: true, passed: true, attemptedAt: true },
          },
        },
      },
    },
  });
  const unlockById = new Map(state.unlockStates.map((unlock) => [unlock.conceptId, unlock]));
  const titleById = new Map(state.concepts.map(({ id, title }) => [id, title]));
  return NextResponse.json({
    course: state.course,
    concepts: records.map((concept) => {
      const unlock = unlockById.get(concept.id);
      const missingPrerequisiteIds = unlock?.missingPrerequisiteIds ?? [];
      return {
        id: concept.id,
        title: concept.title,
        status: unlock?.status ?? "locked",
        missingPrerequisites: missingPrerequisiteIds.map((id) => ({ id, title: titleById.get(id) ?? id })),
        lessonProgress: {
          completed: concept.lessons.filter((lesson) => lesson.progress.length > 0).length,
          total: concept.lessons.length,
          lessons: concept.lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            completedAt: lesson.progress[0]?.completedAt ?? null,
          })),
        },
        quizAttempts: concept.quizzes.flatMap((quiz) =>
          quiz.attempts.map((attempt) => ({
            id: attempt.id,
            quizId: quiz.id,
            quizTitle: quiz.title,
            score: attempt.score,
            passed: attempt.passed,
            attemptedAt: attempt.attemptedAt,
          })),
        ),
      };
    }),
  });
}
