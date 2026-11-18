import { PrismaClient } from "@prisma/client";
import { sampleConcepts, samplePrerequisites } from "../src/lib/sample-course";

const prisma = new PrismaClient();

async function main() {
  const instructor = await prisma.user.upsert({
    where: { email: "instructor@pathwise.demo" },
    update: { name: "PathWise Instructor", role: "INSTRUCTOR" },
    create: {
      name: "PathWise Instructor",
      email: "instructor@pathwise.demo",
      role: "INSTRUCTOR",
    },
  });
  await prisma.user.upsert({
    where: { email: "learner@pathwise.demo" },
    update: { name: "PathWise Learner", role: "LEARNER" },
    create: {
      name: "PathWise Learner",
      email: "learner@pathwise.demo",
      role: "LEARNER",
    },
  });

  const course = await prisma.course.upsert({
    where: { slug: "c-programming-fundamentals" },
    update: {
      title: "C Programming Fundamentals",
      description: "Build a confident foundation in C, one mastered concept at a time.",
      instructorId: instructor.id,
    },
    create: {
      title: "C Programming Fundamentals",
      slug: "c-programming-fundamentals",
      description: "Build a confident foundation in C, one mastered concept at a time.",
      instructorId: instructor.id,
    },
  });

  const conceptIds = new Map<string, string>();
  for (const sample of sampleConcepts) {
    const concept = await prisma.concept.upsert({
      where: { courseId_order: { courseId: course.id, order: sample.order } },
      update: {
        title: sample.title,
        description: sample.description,
        lessonDurationMinutes: sample.durationMinutes,
        archivedAt: null,
      },
      create: {
        courseId: course.id,
        title: sample.title,
        description: sample.description,
        order: sample.order,
        lessonDurationMinutes: sample.durationMinutes,
      },
    });
    conceptIds.set(sample.id, concept.id);

    await prisma.lesson.upsert({
      where: { conceptId_title: { conceptId: concept.id, title: `${sample.title}: Core Lesson` } },
      update: {
        content: sample.lesson,
        durationMinutes: sample.durationMinutes,
        archivedAt: null,
      },
      create: {
        conceptId: concept.id,
        title: `${sample.title}: Core Lesson`,
        content: sample.lesson,
        durationMinutes: sample.durationMinutes,
      },
    });
    const quiz = await prisma.quiz.upsert({
      where: { conceptId_title: { conceptId: concept.id, title: `${sample.title} Checkpoint` } },
      update: { passingThreshold: 70, archivedAt: null },
      create: {
        conceptId: concept.id,
        title: `${sample.title} Checkpoint`,
        passingThreshold: 70,
      },
    });
    await prisma.question.upsert({
      where: { quizId_position: { quizId: quiz.id, position: 1 } },
      update: {
        prompt: sample.quiz.prompt,
        options: sample.quiz.options,
        correctOptionIndex: sample.quiz.correctOptionIndex,
        explanation: sample.quiz.explanation,
        archivedAt: null,
      },
      create: {
        quizId: quiz.id,
        prompt: sample.quiz.prompt,
        options: sample.quiz.options,
        correctOptionIndex: sample.quiz.correctOptionIndex,
        explanation: sample.quiz.explanation,
        position: 1,
      },
    });
  }

  for (const edge of samplePrerequisites) {
    const conceptId = conceptIds.get(edge.conceptId);
    const prerequisiteConceptId = conceptIds.get(edge.prerequisiteId);
    if (!conceptId || !prerequisiteConceptId) {
      throw new Error(`Invalid sample prerequisite: ${edge.prerequisiteId} -> ${edge.conceptId}`);
    }

    await prisma.prerequisite.upsert({
      where: { conceptId_prerequisiteConceptId: { conceptId, prerequisiteConceptId } },
      update: {},
      create: { conceptId, prerequisiteConceptId },
    });
  }

  const learner = await prisma.user.findUniqueOrThrow({
    where: { email: "learner@pathwise.demo" },
  });
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: learner.id, courseId: course.id } },
    update: {},
    create: {
      userId: learner.id,
      courseId: course.id,
    },
  });

  const firstConcept = sampleConcepts[0];
  const firstConceptId = conceptIds.get(firstConcept.id);
  if (!firstConceptId) {
    throw new Error(`Could not find seeded concept ${firstConcept.id}.`);
  }
  const firstLesson = await prisma.lesson.findUniqueOrThrow({
    where: {
      conceptId_title: {
        conceptId: firstConceptId,
        title: `${firstConcept.title}: Core Lesson`,
      },
    },
  });
  await prisma.lessonCompletion.upsert({
    where: {
      userId_lessonId: { userId: learner.id, lessonId: firstLesson.id },
    },
    update: {},
    create: {
      userId: learner.id,
      lessonId: firstLesson.id,
      conceptId: firstConceptId,
    },
  });

  const firstQuiz = await prisma.quiz.findUniqueOrThrow({
    where: {
      conceptId_title: {
        conceptId: firstConceptId,
        title: `${firstConcept.title} Checkpoint`,
      },
    },
  });
  const existingAttempt = await prisma.quizAttempt.findFirst({
    where: { userId: learner.id, quizId: firstQuiz.id },
  });
  if (!existingAttempt) {
    await prisma.quizAttempt.create({
      data: {
        userId: learner.id,
        quizId: firstQuiz.id,
        score: 100,
        passed: true,
        answers: [firstConcept.quiz.correctOptionIndex],
        questionSnapshot: [{
          prompt: firstConcept.quiz.prompt,
          options: firstConcept.quiz.options,
          correctOptionIndex: firstConcept.quiz.correctOptionIndex,
          explanation: firstConcept.quiz.explanation,
          position: 1,
        }],
      },
    });
  }

  for (const sample of sampleConcepts.filter((item) =>
    ["variables", "data-types", "loops"].includes(item.id),
  )) {
    const conceptId = conceptIds.get(sample.id);
    if (!conceptId) throw new Error(`Could not find seeded concept ${sample.id}.`);
    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { conceptId_title: { conceptId, title: `${sample.title} Checkpoint` } },
    });
    const passingAttempt = await prisma.quizAttempt.findFirst({
      where: { userId: learner.id, quizId: quiz.id, passed: true },
    });
    if (!passingAttempt) {
      await prisma.quizAttempt.create({
        data: {
          userId: learner.id,
          quizId: quiz.id,
          score: 100,
          passed: true,
          answers: [sample.quiz.correctOptionIndex],
          questionSnapshot: [{
            prompt: sample.quiz.prompt,
            options: sample.quiz.options,
            correctOptionIndex: sample.quiz.correctOptionIndex,
            explanation: sample.quiz.explanation,
            position: 1,
          }],
        },
      });
    }
  }

  for (const sample of sampleConcepts) {
    const conceptId = conceptIds.get(sample.id);
    if (!conceptId) throw new Error(`Could not find seeded concept ${sample.id}.`);
    const quizzes = await prisma.quiz.findMany({
      where: { conceptId, archivedAt: null },
      include: {
        attempts: {
          where: { userId: learner.id },
          orderBy: { attemptedAt: "desc" },
        },
      },
    });
    const attempts = quizzes.flatMap((quiz) =>
      quiz.attempts.map((attempt) => ({
        ...attempt,
        passingThreshold: quiz.passingThreshold,
      })),
    ).sort((left, right) => right.attemptedAt.getTime() - left.attemptedAt.getTime());
    const latestAttempt = attempts[0];
    if (!latestAttempt) continue;
    const passingAttempt = [...attempts].reverse().find(
      (attempt) => attempt.score >= attempt.passingThreshold,
    );
    const mastered = passingAttempt !== undefined;
    const masteryData = {
      latestAttemptId: latestAttempt.id,
      latestScore: latestAttempt.score,
      passingThreshold: latestAttempt.passingThreshold,
      masteredAt: mastered ? passingAttempt.attemptedAt : null,
    };
    await prisma.conceptMastery.upsert({
      where: { userId_conceptId: { userId: learner.id, conceptId } },
      create: { userId: learner.id, conceptId, ...masteryData },
      update: masteryData,
    });
  }

  console.info(`Seeded ${sampleConcepts.length} concepts for ${course.title}.`);
}

main()
  .catch((error: unknown) => {
    console.error("PathWise seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
