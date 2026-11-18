import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { forbiddenResponse, parseJson, unauthorizedResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { recordCurriculumChange } from "@/lib/curriculum";
import {
  getCycleIfPrerequisiteAdded,
  getShortestLearningPath,
} from "@/lib/learning-graph";
import { getPrismaClient } from "@/lib/prisma";
import { loadLearnerCourseState, recalculateConceptMasteries } from "@/lib/progress";

type RouteContext = { params: Promise<{ conceptId: string }> };

const splitSchema = z.object({
  concepts: z.array(z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(4000).default(""),
    lessonIds: z.array(z.string().min(1).max(128)).default([]),
    quizIds: z.array(z.string().min(1).max(128)).default([]),
    prerequisiteConceptIds: z.array(z.string().min(1).max(128)).default([]),
    prerequisiteIndexes: z.array(z.number().int().min(0).max(4)).default([]),
  }).strict()).min(2).max(5),
}).strict();

function hasDuplicates<T>(values: T[]) {
  return new Set(values).size !== values.length;
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (user.role !== "INSTRUCTOR") return forbiddenResponse();
  const parsed = await parseJson(request, splitSchema);
  if ("response" in parsed) return parsed.response;

  const { conceptId } = await params;
  const prisma = getPrismaClient();
  const existing = await prisma.concept.findFirst({
    where: {
      id: conceptId,
      archivedAt: null,
      course: { instructorId: user.id, archivedAt: null },
    },
    include: {
      lessons: { where: { archivedAt: null }, select: { id: true } },
      quizzes: { where: { archivedAt: null }, select: { id: true } },
      prerequisiteLinks: {
        where: { prerequisite: { archivedAt: null } },
        select: { prerequisiteConceptId: true },
      },
      dependentLinks: {
        where: { concept: { archivedAt: null } },
        select: { conceptId: true },
      },
    },
  });
  if (!existing) return NextResponse.json({ error: "Concept not found." }, { status: 404 });

  const children = parsed.data.concepts;
  const lessonIds = children.flatMap((child) => child.lessonIds);
  const quizIds = children.flatMap((child) => child.quizIds);
  if (hasDuplicates(lessonIds) || hasDuplicates(quizIds)) {
    return NextResponse.json({ error: "Each existing lesson and assessment can be assigned to only one new concept." }, { status: 400 });
  }
  if (
    existing.lessons.some(({ id }) => !lessonIds.includes(id)) ||
    lessonIds.some((id) => !existing.lessons.some((lesson) => lesson.id === id)) ||
    existing.quizzes.some(({ id }) => !quizIds.includes(id)) ||
    quizIds.some((id) => !existing.quizzes.some((quiz) => quiz.id === id))
  ) {
    return NextResponse.json({
      error: "Assign every active lesson and assessment from the original concept to exactly one new concept.",
    }, { status: 400 });
  }
  if (children.some((child, index) =>
    child.prerequisiteIndexes.some((dependency) => dependency === index || dependency >= children.length),
  )) {
    return NextResponse.json({ error: "Split prerequisites must refer to a different new concept in this split." }, { status: 400 });
  }
  if (children.some((child) => child.prerequisiteConceptIds.includes(conceptId))) {
    return NextResponse.json({ error: "The archived concept cannot be a prerequisite of one of its replacements." }, { status: 400 });
  }
  if (children.some((child) =>
    hasDuplicates(child.prerequisiteConceptIds) || hasDuplicates(child.prerequisiteIndexes),
  )) {
    return NextResponse.json({ error: "Prerequisite entries must be unique." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (transaction) => {
    const activeConcepts = await transaction.concept.findMany({
      where: { courseId: existing.courseId, archivedAt: null },
      select: { id: true, title: true, order: true, lessonDurationMinutes: true },
    });
    const existingEdges = await transaction.prerequisite.findMany({
      where: {
        concept: { courseId: existing.courseId, archivedAt: null },
        prerequisite: { courseId: existing.courseId, archivedAt: null },
        conceptId: { not: conceptId },
        prerequisiteConceptId: { not: conceptId },
      },
      select: { conceptId: true, prerequisiteConceptId: true },
    });
    const activeIds = new Set(activeConcepts.map(({ id }) => id));
    for (const child of children) {
      for (const prerequisiteId of child.prerequisiteConceptIds) {
        if (!activeIds.has(prerequisiteId) || prerequisiteId === conceptId) {
          return { error: "Every prerequisite must be an active concept in the same course." } as const;
        }
      }
    }

    const ids = children.map(() => randomUUID());
    const conceptsForGraph = [
      ...activeConcepts
        .filter(({ id }) => id !== conceptId)
        .map((item) => ({
          id: item.id,
          title: item.title,
          order: item.order,
          durationMinutes: item.lessonDurationMinutes,
        })),
      ...children.map((child, index) => ({
        id: ids[index],
        title: child.title,
        order: Math.max(...activeConcepts.map(({ order }) => order), 0) + index + 1,
        durationMinutes: 0,
      })),
    ];

    const edges = [
      ...existingEdges.map((edge) => ({
        conceptId: edge.conceptId,
        prerequisiteId: edge.prerequisiteConceptId,
      })),
    ];
    const proposedEdges: Array<{ conceptId: string; prerequisiteId: string }> = [];
    for (let index = 0; index < children.length; index += 1) {
      for (const { prerequisiteConceptId } of existing.prerequisiteLinks) {
        proposedEdges.push({ conceptId: ids[index], prerequisiteId: prerequisiteConceptId });
      }
      for (const prerequisiteId of children[index].prerequisiteConceptIds) {
        proposedEdges.push({ conceptId: ids[index], prerequisiteId });
      }
      for (const dependencyIndex of children[index].prerequisiteIndexes) {
        proposedEdges.push({ conceptId: ids[index], prerequisiteId: ids[dependencyIndex] });
      }
    }
    for (const { conceptId: dependentId } of existing.dependentLinks) {
      if (dependentId !== conceptId) {
        for (const newConceptId of ids) {
          proposedEdges.push({ conceptId: dependentId, prerequisiteId: newConceptId });
        }
      }
    }

    const candidateEdges = [...edges];
    for (const edge of proposedEdges) {
      if (candidateEdges.some((item) =>
        item.conceptId === edge.conceptId && item.prerequisiteId === edge.prerequisiteId,
      )) continue;
      const cycle = getCycleIfPrerequisiteAdded(
        edge.conceptId,
        edge.prerequisiteId,
        conceptsForGraph,
        candidateEdges,
      );
      if (cycle) {
        const titleById = new Map(conceptsForGraph.map(({ id, title }) => [id, title]));
        return {
          error: `This split would create a prerequisite cycle: ${cycle.map((id) => titleById.get(id) ?? id).join(" → ")}.`,
          cycle,
        } as const;
      }
      candidateEdges.push(edge);
    }

    const createdConcepts = [];
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      const created = await transaction.concept.create({
        data: {
          id: ids[index],
          courseId: existing.courseId,
          title: child.title,
          description: child.description,
          order: conceptsForGraph.find(({ id }) => id === ids[index])!.order,
        },
      });
      createdConcepts.push(created);
      if (child.lessonIds.length > 0) {
        await transaction.lesson.updateMany({
          where: { id: { in: child.lessonIds }, conceptId },
          data: { conceptId: created.id },
        });
      }
      if (child.quizIds.length > 0) {
        await transaction.quiz.updateMany({
          where: { id: { in: child.quizIds }, conceptId },
          data: { conceptId: created.id },
        });
      }
    }

    const activeDependentIds = [...new Set(existing.dependentLinks.map(({ conceptId: id }) => id))]
      .filter((id) => id !== conceptId);
    if (activeDependentIds.length > 0) {
      await transaction.prerequisite.deleteMany({
        where: { conceptId: { in: activeDependentIds }, prerequisiteConceptId: conceptId },
      });
    }
    const uniqueEdges = [...new Map(proposedEdges.map((edge) => [
      `${edge.conceptId}\u0000${edge.prerequisiteId}`,
      edge,
    ])).values()];
    if (uniqueEdges.length > 0) {
      await transaction.prerequisite.createMany({
        data: uniqueEdges.map((edge) => ({
          conceptId: edge.conceptId,
          prerequisiteConceptId: edge.prerequisiteId,
        })),
      });
    }
    await transaction.concept.update({
      where: { id: conceptId },
      data: { archivedAt: new Date() },
    });
    await transaction.conceptMastery.updateMany({
      where: { conceptId },
      data: {
        latestAttemptId: null,
        latestScore: null,
        passingThreshold: null,
        masteredAt: null,
      },
    });

    for (const created of createdConcepts) {
      await recalculateConceptMasteries(transaction, created.id);
    }

    const priorPaths = await transaction.learningPath.findMany({
      where: { courseId: existing.courseId, targetConceptId: conceptId },
      orderBy: { calculatedAt: "desc" },
      distinct: ["userId"],
      select: { userId: true },
    });
    const replacementTargetId = createdConcepts[createdConcepts.length - 1].id;
    await recordCurriculumChange(transaction, {
      courseId: existing.courseId,
      actorId: user.id,
      conceptId,
      kind: "CONCEPT_SPLIT",
      summary: `${existing.title} was split into ${createdConcepts.map(({ title }) => title).join(" and ")}. Quiz attempts and lesson completion history were retained.`,
      beforeSnapshot: {
        id: existing.id,
        title: existing.title,
        lessonIds: existing.lessons.map(({ id }) => id),
        quizIds: existing.quizzes.map(({ id }) => id),
      },
      afterSnapshot: {
        concepts: createdConcepts.map(({ id, title, order }) => ({ id, title, order })),
      },
    });

    for (const { userId } of priorPaths) {
      const state = await loadLearnerCourseState(transaction, userId, existing.courseId);
      if (!state) continue;
      const path = getShortestLearningPath(
        replacementTargetId,
        state.concepts,
        state.edges,
        state.masteredConceptIds,
      );
      await transaction.learningPath.create({
        data: {
          userId,
          courseId: existing.courseId,
          targetConceptId: replacementTargetId,
          curriculumRevision: state.course.curriculumRevision,
          conceptIds: path.conceptIds,
          estimatedMinutes: path.estimatedMinutes,
        },
      });
    }
    return { concepts: createdConcepts };
  });

  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result, { status: 201 });
}
