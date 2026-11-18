import "server-only";
import type { Prisma } from "@prisma/client";
import { refreshStoredLearningPaths } from "@/lib/progress";

type CurriculumChangeInput = {
  courseId: string;
  actorId: string;
  kind: string;
  summary: string;
  conceptId?: string;
  beforeSnapshot?: Prisma.InputJsonValue;
  afterSnapshot?: Prisma.InputJsonValue;
};

export async function recordCurriculumChange(
  transaction: Prisma.TransactionClient,
  input: CurriculumChangeInput,
) {
  const course = await transaction.course.update({
    where: { id: input.courseId },
    data: { curriculumRevision: { increment: 1 } },
    select: { curriculumRevision: true },
  });
  const change = await transaction.curriculumChange.create({
    data: {
      courseId: input.courseId,
      actorId: input.actorId,
      conceptId: input.conceptId,
      revision: course.curriculumRevision,
      kind: input.kind,
      summary: input.summary,
      beforeSnapshot: input.beforeSnapshot,
      afterSnapshot: input.afterSnapshot,
    },
  });
  const enrollments = await transaction.enrollment.findMany({
    where: { courseId: input.courseId },
    select: { userId: true },
  });
  if (enrollments.length > 0) {
    await transaction.notification.createMany({
      data: enrollments.map(({ userId }) => ({
        userId,
        title: "Course curriculum updated",
        message: input.summary,
      })),
    });
  }
  await refreshStoredLearningPaths(transaction, input.courseId);

  return change;
}
