import "server-only";
import {
  getMasteredConceptIds,
  getShortestLearningPath,
  getUnlockStates,
  type PrerequisiteEdge,
} from "@/lib/learning-graph";
import {
  getCurrentLearningStreak,
  getMonthlyLearningMinutes,
} from "@/lib/dashboard-metrics";
import { getPrismaClient } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth";

export type DashboardConcept = {
  id: string;
  title: string;
  description: string;
  order: number;
  durationMinutes: number;
  status: "mastered" | "unlocked" | "locked";
  prerequisiteTitles: string[];
  missingPrerequisiteTitles: string[];
  lessonCount: number;
  quizCount: number;
  lessons: {
    title: string;
    durationMinutes: number;
    completedAt: string | null;
  }[];
  latestQuizScore: number | null;
  quizAttemptCount: number;
};

export type DashboardCourse = {
  id: string;
  title: string;
  slug: string;
  description: string;
  curriculumRevision: number;
  concepts: DashboardConcept[];
  edges: PrerequisiteEdge[];
  masteredCount: number;
  progressPercent: number;
  learnerCount: number;
  totalDurationMinutes: number;
};

export type DashboardActivity = {
  id: string;
  kind: "lesson" | "quiz";
  courseTitle: string;
  conceptId: string;
  conceptTitle: string;
  score: number | null;
  passed: boolean | null;
  durationMinutes: number;
  timestamp: string;
};

export type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
};

export type DashboardData = {
  profile: {
    id: string;
    name: string;
    email: string;
    role: "LEARNER" | "INSTRUCTOR";
  };
  courses: DashboardCourse[];
  selectedCourseId: string;
  totalLearningMinutes: number;
  weeklyLearningMinutes: number;
  streakDays: number;
  monthlyLearning: ReturnType<typeof getMonthlyLearningMinutes>;
  recentActivity: DashboardActivity[];
  notifications: DashboardNotification[];
  learningPath: {
    targetConceptId: string | null;
    conceptIds: string[];
    estimatedMinutes: number;
  };
};

export type DashboardLoadResult =
  | { kind: "profile-missing"; email: string }
  | {
      kind: "no-courses";
      profile: DashboardData["profile"];
    }
  | { kind: "ready"; data: DashboardData };

export async function loadDashboardData(
  authUser: AuthUser,
  requestedCourseId?: string,
): Promise<DashboardLoadResult> {
  const prisma = getPrismaClient();
  const profile = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!profile) {
    return { kind: "profile-missing", email: authUser.email };
  }
  const role = profile.role;
  if (role !== "LEARNER" && role !== "INSTRUCTOR") {
    throw new Error(`Unsupported local demo role: ${role}`);
  }

  const courses = await prisma.course.findMany({
    where:
      role === "INSTRUCTOR"
        ? { instructorId: profile.id, archivedAt: null }
        : { enrollments: { some: { userId: profile.id } }, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      enrollments: { select: { userId: true } },
      concepts: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        include: {
          prerequisiteLinks: {
            include: {
              prerequisite: {
                select: { id: true, title: true, archivedAt: true },
              },
            },
          },
          lessons: {
            where: { archivedAt: null },
            orderBy: { createdAt: "asc" },
            include: {
              progress: {
                where: { userId: profile.id },
                select: { completedAt: true },
              },
            },
          },
          quizzes: {
            where: { archivedAt: null },
            orderBy: { createdAt: "asc" },
            include: {
              attempts: {
                where: { userId: profile.id },
                orderBy: { attemptedAt: "desc" },
                select: { score: true, passed: true, attemptedAt: true },
              },
            },
          },
        },
      },
    },
  });

  const selectedCourse =
    courses.find((course) => course.id === requestedCourseId) ?? courses[0];
  if (!selectedCourse) {
    return {
      kind: "no-courses",
      profile: { ...profile, role },
    };
  }

  const courseDtos = courses.map((course): DashboardCourse => {
    const graphConcepts = course.concepts.map((concept) => ({
      id: concept.id,
      title: concept.title,
      durationMinutes:
        concept.lessons.reduce((total, lesson) => total + lesson.durationMinutes, 0) ||
        concept.lessonDurationMinutes,
      order: concept.order,
    }));
    const graphConceptIds = new Set(graphConcepts.map((concept) => concept.id));
    const edges = course.concepts.flatMap((concept) =>
      concept.prerequisiteLinks
        .filter(
          (link) =>
            link.prerequisite.archivedAt === null &&
            graphConceptIds.has(link.prerequisite.id),
        )
        .map((link) => ({
          conceptId: concept.id,
          prerequisiteId: link.prerequisite.id,
        })),
    );
    const quizzes = course.concepts.flatMap((concept) =>
      concept.quizzes.map((quiz) => ({
        id: quiz.id,
        conceptId: concept.id,
        passingThreshold: quiz.passingThreshold,
      })),
    );
    const attempts = course.concepts.flatMap((concept) =>
      concept.quizzes.flatMap((quiz) =>
        quiz.attempts.map((attempt) => ({
          quizId: quiz.id,
          score: attempt.score,
        })),
      ),
    );
    const masteredConceptIds =
      role === "LEARNER"
        ? getMasteredConceptIds(quizzes, attempts)
        : new Set<string>();
    const unlockStates = getUnlockStates(
      graphConcepts,
      edges,
      masteredConceptIds,
    );
    const unlockStateById = new Map(
      unlockStates.map((state) => [state.conceptId, state]),
    );
    const conceptTitles = new Map(
      course.concepts.map((concept) => [concept.id, concept.title]),
    );
    const concepts = course.concepts.map((concept): DashboardConcept => {
      const state = unlockStateById.get(concept.id);
      const quizAttempts = concept.quizzes.flatMap((quiz) =>
        quiz.attempts.map((attempt) => ({
          score: attempt.score,
          passed: attempt.passed,
          attemptedAt: attempt.attemptedAt,
        })),
      );
      quizAttempts.sort(
        (left, right) => right.attemptedAt.getTime() - left.attemptedAt.getTime(),
      );

      return {
        id: concept.id,
        title: concept.title,
        description: concept.description,
        order: concept.order,
        durationMinutes:
          concept.lessons.reduce(
            (total, lesson) => total + lesson.durationMinutes,
            0,
          ) || concept.lessonDurationMinutes,
        status: state?.status ?? "locked",
        prerequisiteTitles: concept.prerequisiteLinks
          .filter((link) => link.prerequisite.archivedAt === null)
          .map((link) => link.prerequisite.title),
        missingPrerequisiteTitles: (state?.missingPrerequisiteIds ?? [])
          .map((id) => conceptTitles.get(id))
          .filter((title): title is string => Boolean(title)),
        lessonCount: concept.lessons.length,
        quizCount: concept.quizzes.length,
        lessons: concept.lessons.map((lesson) => ({
          title: lesson.title,
          durationMinutes: lesson.durationMinutes,
          completedAt: lesson.progress[0]?.completedAt.toISOString() ?? null,
        })),
        latestQuizScore: quizAttempts[0]?.score ?? null,
        quizAttemptCount: quizAttempts.length,
      };
    });
    const masteredCount = masteredConceptIds.size;

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      curriculumRevision: course.curriculumRevision,
      concepts,
      edges,
      masteredCount,
      progressPercent: concepts.length
        ? Math.round((masteredCount / concepts.length) * 100)
        : 0,
      learnerCount: course.enrollments.length,
      totalDurationMinutes: graphConcepts.reduce(
        (total, concept) => total + concept.durationMinutes,
        0,
      ),
    };
  });

  const selectedCourseDto =
    courseDtos.find((course) => course.id === selectedCourse.id) ?? courseDtos[0];
  const completedLessons = courses.flatMap((course) =>
    course.concepts.flatMap((concept) =>
      concept.lessons.flatMap((lesson) =>
        lesson.progress.map((progress) => ({
          completedAt: progress.completedAt,
          durationMinutes: lesson.durationMinutes,
          courseTitle: course.title,
          conceptId: concept.id,
          conceptTitle: concept.title,
          lessonTitle: lesson.title,
          lessonId: lesson.id,
        })),
      ),
    ),
  );
  const quizActivities = courses.flatMap((course) =>
    course.concepts.flatMap((concept) =>
      concept.quizzes.flatMap((quiz) =>
        quiz.attempts.map((attempt, index) => ({
          id: `${quiz.id}-${attempt.attemptedAt.toISOString()}-${index}`,
          kind: "quiz" as const,
          courseTitle: course.title,
          conceptId: concept.id,
          conceptTitle: concept.title,
          score: attempt.score,
          passed: attempt.passed,
          durationMinutes: 0,
          timestamp: attempt.attemptedAt.toISOString(),
        })),
      ),
    ),
  );
  const lessonActivities = completedLessons.map((completion) => ({
    id: completion.lessonId,
    kind: "lesson" as const,
    courseTitle: completion.courseTitle,
    conceptId: completion.conceptId,
    conceptTitle: completion.conceptTitle,
    score: null,
    passed: null,
    durationMinutes: completion.durationMinutes,
    timestamp: completion.completedAt.toISOString(),
  }));
  const recentActivity = [...quizActivities, ...lessonActivities]
    .sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    )
    .slice(0, 8);
  const activityDates = [
    ...quizActivities.map((activity) => new Date(activity.timestamp)),
    ...completedLessons.map((completion) => completion.completedAt),
  ];
  const now = new Date();
  const unreadNotifications = await prisma.notification.findMany({
    where: { userId: profile.id, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, title: true, message: true, createdAt: true },
  });
  const targetConcept =
    role === "LEARNER"
      ? selectedCourseDto.concepts.find((concept) => concept.status === "locked") ??
        selectedCourseDto.concepts.find((concept) => concept.status === "unlocked")
      : undefined;
  const path =
    targetConcept && role === "LEARNER"
      ? getShortestLearningPath(
          targetConcept.id,
          selectedCourseDto.concepts.map((concept) => ({
            id: concept.id,
            title: concept.title,
            durationMinutes: concept.durationMinutes,
            order: concept.order,
          })),
          selectedCourseDto.edges,
          new Set(
            selectedCourseDto.concepts
              .filter((concept) => concept.status === "mastered")
              .map((concept) => concept.id),
          ),
        )
      : { conceptIds: [], estimatedMinutes: 0 };

  return {
    kind: "ready",
    data: {
      profile: { ...profile, role },
      courses: courseDtos,
      selectedCourseId: selectedCourseDto.id,
      totalLearningMinutes: completedLessons.reduce(
        (total, completion) => total + completion.durationMinutes,
        0,
      ),
      weeklyLearningMinutes: completedLessons.reduce((total, completion) => {
        const daysSinceCompletion =
          (now.getTime() - completion.completedAt.getTime()) / (24 * 60 * 60 * 1000);
        return total + (
          daysSinceCompletion >= 0 && daysSinceCompletion < 7
            ? completion.durationMinutes
            : 0
        );
      }, 0),
      streakDays: getCurrentLearningStreak(activityDates, now),
      monthlyLearning: getMonthlyLearningMinutes(
        completedLessons.map((completion) => ({
          completedAt: completion.completedAt,
          durationMinutes: completion.durationMinutes,
        })),
        now,
      ),
      recentActivity,
      notifications: unreadNotifications.map((notification) => ({
        ...notification,
        createdAt: notification.createdAt.toISOString(),
      })),
      learningPath: {
        targetConceptId: targetConcept?.id ?? null,
        conceptIds: path.conceptIds,
        estimatedMinutes: path.estimatedMinutes,
      },
    },
  };
}
