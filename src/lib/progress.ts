import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  getMasteredConceptIds,
  getShortestLearningPath,
  getUnlockStates,
  type LearningConcept,
  type PrerequisiteEdge,
} from "@/lib/learning-graph";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export async function loadLearnerCourseState(
  database: DatabaseClient,
  userId: string,
  courseId: string,
) {
  const course = await database.course.findFirst({
    where: {
      id: courseId,
      archivedAt: null,
      enrollments: { some: { userId } },
    },
    select: { id: true, title: true, curriculumRevision: true },
  });
  if (!course) return null;

  const records = await database.concept.findMany({
    where: { courseId, archivedAt: null },
    orderBy: { order: "asc" },
    include: {
      lessons: { where: { archivedAt: null }, select: { durationMinutes: true } },
      quizzes: {
        where: { archivedAt: null },
        select: {
          id: true,
          passingThreshold: true,
          attempts: {
            where: { userId },
            select: { score: true, attemptedAt: true },
            orderBy: { attemptedAt: "desc" },
          },
        },
      },
    },
  });
  const concepts: LearningConcept[] = records.map((concept) => ({
    id: concept.id,
    title: concept.title,
    order: concept.order,
    durationMinutes:
      concept.lessons.reduce((total, lesson) => total + lesson.durationMinutes, 0) ||
      concept.lessonDurationMinutes,
  }));
  const activeIds = new Set(concepts.map(({ id }) => id));
  const prerequisiteRecords = await database.prerequisite.findMany({
    where: {
      conceptId: { in: [...activeIds] },
      prerequisiteConceptId: { in: [...activeIds] },
    },
    select: { conceptId: true, prerequisiteConceptId: true },
  });
  const edges: PrerequisiteEdge[] = prerequisiteRecords.map((edge) => ({
    conceptId: edge.conceptId,
    prerequisiteId: edge.prerequisiteConceptId,
  }));
  const quizzes = records.flatMap((concept) =>
    concept.quizzes.map((quiz) => ({
      id: quiz.id,
      conceptId: concept.id,
      passingThreshold: quiz.passingThreshold,
    })),
  );
  const attempts = records.flatMap((concept) =>
    concept.quizzes.flatMap((quiz) =>
      quiz.attempts.map((attempt) => ({ quizId: quiz.id, score: attempt.score })),
    ),
  );
  const masteredConceptIds = getMasteredConceptIds(quizzes, attempts);
  const unlockStates = getUnlockStates(concepts, edges, masteredConceptIds);

  return {
    course,
    concepts,
    edges,
    quizzes,
    attempts,
    masteredConceptIds,
    unlockStates,
  };
}

export async function getLearnerConceptAvailability(
  database: DatabaseClient,
  userId: string,
  conceptId: string,
) {
  const concept = await database.concept.findFirst({
    where: { id: conceptId, archivedAt: null, course: { archivedAt: null } },
    select: { courseId: true },
  });
  if (!concept) return null;

  const state = await loadLearnerCourseState(database, userId, concept.courseId);
  if (!state) return null;
  const unlock = state.unlockStates.find((item) => item.conceptId === conceptId);
  if (!unlock) return null;
  const titleById = new Map(state.concepts.map(({ id, title }) => [id, title]));
  return {
    status: unlock.status,
    missingPrerequisiteTitles: unlock.missingPrerequisiteIds.map((id) => titleById.get(id) ?? id),
  };
}

export async function refreshStoredLearningPaths(
  database: DatabaseClient,
  courseId: string,
  userId?: string,
) {
  const savedPaths = await database.learningPath.findMany({
    where: { courseId, ...(userId ? { userId } : {}) },
    orderBy: { calculatedAt: "desc" },
    select: { id: true, userId: true, targetConceptId: true },
  });
  const latestByTarget = new Map<string, (typeof savedPaths)[number]>();
  for (const savedPath of savedPaths) {
    const key = `${savedPath.userId}\u0000${savedPath.targetConceptId}`;
    if (!latestByTarget.has(key)) latestByTarget.set(key, savedPath);
  }

  for (const savedPath of latestByTarget.values()) {
    const state = await loadLearnerCourseState(database, savedPath.userId, courseId);
    const target = state?.concepts.find(({ id }) => id === savedPath.targetConceptId);
    if (!state || !target) continue;
    const path = getShortestLearningPath(
      target.id,
      state.concepts,
      state.edges,
      state.masteredConceptIds,
    );
    await database.learningPath.create({
      data: {
        userId: savedPath.userId,
        courseId,
        targetConceptId: target.id,
        curriculumRevision: state.course.curriculumRevision,
        conceptIds: path.conceptIds,
        estimatedMinutes: path.estimatedMinutes,
      },
    });
  }
}

export async function recalculateConceptMasteries(
  database: DatabaseClient,
  conceptId: string,
) {
  const concept = await database.concept.findUnique({
    where: { id: conceptId },
    select: {
      courseId: true,
      quizzes: {
        where: { archivedAt: null },
        select: {
          id: true,
          passingThreshold: true,
          attempts: {
            orderBy: { attemptedAt: "desc" },
            select: { id: true, userId: true, quizId: true, score: true, attemptedAt: true },
          },
        },
      },
    },
  });
  if (!concept) throw new Error(`Cannot recalculate mastery for missing concept "${conceptId}".`);

  const enrollments = await database.enrollment.findMany({
    where: { courseId: concept.courseId },
    select: { userId: true },
  });
  const quizzes = concept.quizzes.map(({ id, passingThreshold }) => ({
    id,
    conceptId,
    passingThreshold,
  }));
  const oldMasteries = await database.conceptMastery.findMany({
    where: { conceptId },
    select: { userId: true, masteredAt: true },
  });
  const priorMasteryByUser = new Map(oldMasteries.map((mastery) => [mastery.userId, mastery]));

  for (const { userId } of enrollments) {
    const userAttempts = concept.quizzes.flatMap((quiz) =>
      quiz.attempts.filter((attempt) => attempt.userId === userId),
    );
    const mastered = getMasteredConceptIds(
      quizzes,
      userAttempts.map((attempt) => ({ quizId: attempt.quizId, score: attempt.score })),
    ).has(conceptId);
    const latestAttempt = userAttempts[0];
    const passingAttempt = [...userAttempts]
      .reverse()
      .find((attempt) => {
        const quiz = concept.quizzes.find(({ id }) => id === attempt.quizId);
        return quiz !== undefined && attempt.score >= quiz.passingThreshold;
      });
    const priorMastery = priorMasteryByUser.get(userId);
    await database.conceptMastery.upsert({
      where: { userId_conceptId: { userId, conceptId } },
      create: {
        userId,
        conceptId,
        latestAttemptId: latestAttempt?.id,
        latestScore: latestAttempt?.score,
        passingThreshold: latestAttempt
          ? concept.quizzes.find(({ id }) => id === latestAttempt.quizId)?.passingThreshold
          : null,
        masteredAt: mastered ? passingAttempt?.attemptedAt ?? new Date() : null,
      },
      update: {
        latestAttemptId: latestAttempt?.id ?? null,
        latestScore: latestAttempt?.score ?? null,
        passingThreshold: latestAttempt
          ? concept.quizzes.find(({ id }) => id === latestAttempt.quizId)?.passingThreshold ?? null
          : null,
        masteredAt: mastered
          ? priorMastery?.masteredAt ?? passingAttempt?.attemptedAt ?? new Date()
          : null,
      },
    });
  }
}
