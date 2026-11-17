export type LearningConcept = {
  id: string;
  title: string;
  durationMinutes: number;
  order: number;
};

export type PrerequisiteEdge = {
  conceptId: string;
  prerequisiteId: string;
};

export type UnlockState = {
  conceptId: string;
  status: "mastered" | "unlocked" | "locked";
  missingPrerequisiteIds: string[];
};

export type LearningPath = {
  conceptIds: string[];
  estimatedMinutes: number;
};

export type MasteryQuiz = {
  id: string;
  conceptId: string;
  passingThreshold: number;
};

export type QuizAttemptResult = {
  quizId: string;
  score: number;
};

export function getMasteredConceptIds(
  quizzes: MasteryQuiz[],
  attempts: QuizAttemptResult[],
): Set<string> {
  const quizzesById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  if (quizzesById.size !== quizzes.length) {
    throw new Error("Quiz IDs must be unique.");
  }

  for (const quiz of quizzes) {
    if (!Number.isFinite(quiz.passingThreshold) || quiz.passingThreshold < 0 || quiz.passingThreshold > 100) {
      throw new Error(`Quiz "${quiz.id}" must have a passing threshold between 0 and 100.`);
    }
  }

  const masteredConceptIds = new Set<string>();
  for (const attempt of attempts) {
    const quiz = quizzesById.get(attempt.quizId);
    if (!quiz) continue;
    if (!Number.isFinite(attempt.score) || attempt.score < 0 || attempt.score > 100) {
      throw new Error(`Attempt for quiz "${attempt.quizId}" must have a score between 0 and 100.`);
    }
    if (attempt.score >= quiz.passingThreshold) {
      masteredConceptIds.add(quiz.conceptId);
    }
  }

  return masteredConceptIds;
}

function assertGraphReferences(
  concepts: LearningConcept[],
  edges: PrerequisiteEdge[],
): Map<string, LearningConcept> {
  const conceptsById = new Map(concepts.map((concept) => [concept.id, concept]));

  if (conceptsById.size !== concepts.length) {
    throw new Error("Concept IDs must be unique.");
  }

  for (const concept of concepts) {
    if (!Number.isFinite(concept.durationMinutes) || concept.durationMinutes < 0) {
      throw new Error(`Concept "${concept.id}" must have a non-negative duration.`);
    }
  }

  for (const edge of edges) {
    if (!conceptsById.has(edge.conceptId) || !conceptsById.has(edge.prerequisiteId)) {
      throw new Error("Prerequisite edges must reference concepts in the same graph.");
    }
  }

  return conceptsById;
}

function buildDependents(edges: PrerequisiteEdge[]): Map<string, string[]> {
  const dependents = new Map<string, string[]>();
  for (const edge of edges) {
    const list = dependents.get(edge.prerequisiteId) ?? [];
    list.push(edge.conceptId);
    dependents.set(edge.prerequisiteId, list);
  }
  return dependents;
}

function findPath(
  startId: string,
  targetId: string,
  dependents: Map<string, string[]>,
): string[] | null {
  const queue = [startId];
  const previous = new Map<string, string | null>([[startId, null]]);

  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    if (currentId === targetId) {
      const path: string[] = [];
      let step: string | null = currentId;
      while (step !== null) {
        path.push(step);
        step = previous.get(step) ?? null;
      }
      return path.reverse();
    }

    for (const dependentId of dependents.get(currentId) ?? []) {
      if (!previous.has(dependentId)) {
        previous.set(dependentId, currentId);
        queue.push(dependentId);
      }
    }
  }

  return null;
}

export function getCycleIfPrerequisiteAdded(
  conceptId: string,
  prerequisiteId: string,
  concepts: LearningConcept[],
  edges: PrerequisiteEdge[],
): string[] | null {
  assertGraphReferences(concepts, edges);
  const conceptsById = new Map(concepts.map((concept) => [concept.id, concept]));

  if (!conceptsById.has(conceptId) || !conceptsById.has(prerequisiteId)) {
    throw new Error("Both concepts must exist before adding a prerequisite.");
  }

  const path = findPath(conceptId, prerequisiteId, buildDependents(edges));
  return path ? [prerequisiteId, ...path] : null;
}

export function getUnlockStates(
  concepts: LearningConcept[],
  edges: PrerequisiteEdge[],
  masteredConceptIds: ReadonlySet<string>,
): UnlockState[] {
  assertGraphReferences(concepts, edges);
  const prerequisites = new Map<string, string[]>();
  for (const edge of edges) {
    const list = prerequisites.get(edge.conceptId) ?? [];
    list.push(edge.prerequisiteId);
    prerequisites.set(edge.conceptId, list);
  }

  return concepts.map((concept) => {
    const missingPrerequisiteIds = (prerequisites.get(concept.id) ?? []).filter(
      (prerequisiteId) => !masteredConceptIds.has(prerequisiteId),
    );
    const mastered = masteredConceptIds.has(concept.id);

    return {
      conceptId: concept.id,
      status: mastered ? "mastered" : missingPrerequisiteIds.length > 0 ? "locked" : "unlocked",
      missingPrerequisiteIds: mastered ? [] : missingPrerequisiteIds,
    };
  });
}

export function getShortestLearningPath(
  targetConceptId: string,
  concepts: LearningConcept[],
  edges: PrerequisiteEdge[],
  masteredConceptIds: ReadonlySet<string>,
): LearningPath {
  const conceptsById = assertGraphReferences(concepts, edges);
  const target = conceptsById.get(targetConceptId);
  if (!target) {
    throw new Error(`Target concept "${targetConceptId}" does not exist.`);
  }

  const prerequisites = new Map<string, string[]>();
  for (const edge of edges) {
    const list = prerequisites.get(edge.conceptId) ?? [];
    list.push(edge.prerequisiteId);
    prerequisites.set(edge.conceptId, list);
  }

  const requiredIds = new Set<string>();
  const collectPrerequisites = (conceptId: string) => {
    if (requiredIds.has(conceptId)) return;
    requiredIds.add(conceptId);
    for (const prerequisiteId of prerequisites.get(conceptId) ?? []) {
      collectPrerequisites(prerequisiteId);
    }
  };
  collectPrerequisites(targetConceptId);

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const conceptId of requiredIds) inDegree.set(conceptId, 0);

  for (const edge of edges) {
    if (!requiredIds.has(edge.conceptId) || !requiredIds.has(edge.prerequisiteId)) continue;
    inDegree.set(edge.conceptId, (inDegree.get(edge.conceptId) ?? 0) + 1);
    const list = dependents.get(edge.prerequisiteId) ?? [];
    list.push(edge.conceptId);
    dependents.set(edge.prerequisiteId, list);
  }

  const byCurriculumOrder = (leftId: string, rightId: string) => {
    const left = conceptsById.get(leftId)!;
    const right = conceptsById.get(rightId)!;
    return left.order - right.order || left.id.localeCompare(right.id);
  };
  const ready = [...requiredIds]
    .filter((conceptId) => inDegree.get(conceptId) === 0)
    .sort(byCurriculumOrder);
  const orderedIds: string[] = [];

  while (ready.length > 0) {
    const currentId = ready.shift()!;
    orderedIds.push(currentId);
    for (const dependentId of dependents.get(currentId) ?? []) {
      const degree = (inDegree.get(dependentId) ?? 0) - 1;
      inDegree.set(dependentId, degree);
      if (degree === 0) {
        ready.push(dependentId);
        ready.sort(byCurriculumOrder);
      }
    }
  }

  if (orderedIds.length !== requiredIds.size) {
    throw new Error("Cannot calculate a learning path for a cyclic prerequisite graph.");
  }

  const conceptIds = orderedIds.filter((conceptId) => !masteredConceptIds.has(conceptId));
  return {
    conceptIds,
    estimatedMinutes: conceptIds.reduce(
      (total, conceptId) => total + conceptsById.get(conceptId)!.durationMinutes,
      0,
    ),
  };
}
