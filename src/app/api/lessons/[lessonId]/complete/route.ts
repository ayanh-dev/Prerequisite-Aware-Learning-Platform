import { NextResponse } from "next/server";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { loadLearnerCourseState } from "@/lib/progress";
import { getPrismaClient } from "@/lib/prisma";

type RouteContext = { params: Promise<{ lessonId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "LEARNER") return forbiddenResponse();
  const { lessonId } = await params;
  const prisma = getPrismaClient();
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      archivedAt: null,
      concept: { archivedAt: null, course: { archivedAt: null } },
    },
    select: { id: true, conceptId: true, concept: { select: { courseId: true } } },
  });
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const result = await prisma.$transaction(async (transaction) => {
    const state = await loadLearnerCourseState(transaction, user.id, lesson.concept.courseId);
    if (!state) return { error: "You must enroll in this course before completing lessons.", status: 403 } as const;
    const unlock = state.unlockStates.find(({ conceptId }) => conceptId === lesson.conceptId);
    if (!unlock || unlock.status === "locked") {
      const missing = unlock?.missingPrerequisiteIds ?? [];
      return {
        error: "This concept is locked until all prerequisites are mastered.",
        status: 403,
        missingPrerequisiteIds: missing,
      } as const;
    }
    const existing = await transaction.lessonCompletion.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId } },
    });
    if (existing) return { completion: existing, alreadyCompleted: true } as const;

    const completion = await transaction.lessonCompletion.create({
      data: { userId: user.id, lessonId, conceptId: lesson.conceptId },
    });
    return { completion, alreadyCompleted: false } as const;
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error, ...("missingPrerequisiteIds" in result ? { missingPrerequisiteIds: result.missingPrerequisiteIds } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json(result);
}
