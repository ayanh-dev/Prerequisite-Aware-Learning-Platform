import assert from "node:assert/strict";
import test from "node:test";
import {
  getCycleIfPrerequisiteAdded,
  getMasteredConceptIds,
  getShortestLearningPath,
  getUnlockStates,
  type LearningConcept,
  type PrerequisiteEdge,
} from "./learning-graph";

const concepts: LearningConcept[] = [
  { id: "intro", title: "Introduction", durationMinutes: 10, order: 1 },
  { id: "variables", title: "Variables", durationMinutes: 15, order: 2 },
  { id: "types", title: "Data Types", durationMinutes: 20, order: 3 },
  { id: "operators", title: "Operators", durationMinutes: 18, order: 4 },
  { id: "functions", title: "Functions", durationMinutes: 30, order: 5 },
];

const edges: PrerequisiteEdge[] = [
  { conceptId: "variables", prerequisiteId: "intro" },
  { conceptId: "types", prerequisiteId: "variables" },
  { conceptId: "operators", prerequisiteId: "types" },
  { conceptId: "functions", prerequisiteId: "variables" },
  { conceptId: "functions", prerequisiteId: "types" },
];

test("derives current mastery from attempt scores and current quiz thresholds", () => {
  const quizzes = [
    { id: "variables-check", conceptId: "variables", passingThreshold: 80 },
    { id: "types-check", conceptId: "types", passingThreshold: 70 },
  ];
  assert.deepEqual(
    getMasteredConceptIds(quizzes, [
      { quizId: "variables-check", score: 79 },
      { quizId: "types-check", score: 70 },
      { quizId: "archived-quiz", score: 100 },
    ]),
    new Set(["types"]),
  );
  assert.deepEqual(
    getMasteredConceptIds([{ ...quizzes[0], passingThreshold: 75 }], [
      { quizId: "variables-check", score: 79 },
    ]),
    new Set(["variables"]),
  );
});

test("reports the exact cycle introduced by a prerequisite edge", () => {
  assert.deepEqual(
    getCycleIfPrerequisiteAdded("intro", "functions", concepts, edges),
    ["functions", "intro", "variables", "functions"],
  );
  assert.deepEqual(
    getCycleIfPrerequisiteAdded("functions", "functions", concepts, edges),
    ["functions", "functions"],
  );
  assert.equal(getCycleIfPrerequisiteAdded("functions", "operators", concepts, edges), null);
});

test("unlocks concepts only when all prerequisites are mastered", () => {
  const states = getUnlockStates(concepts, edges, new Set(["intro", "variables"]));
  assert.deepEqual(states.find((state) => state.conceptId === "functions"), {
    conceptId: "functions",
    status: "locked",
    missingPrerequisiteIds: ["types"],
  });
  assert.equal(states.find((state) => state.conceptId === "types")?.status, "unlocked");
});

test("returns the prerequisite closure in order and skips mastered concepts", () => {
  assert.deepEqual(
    getShortestLearningPath("functions", concepts, edges, new Set(["intro", "variables"])),
    { conceptIds: ["types", "functions"], estimatedMinutes: 50 },
  );
  assert.deepEqual(
    getShortestLearningPath("functions", concepts, edges, new Set(["intro", "variables", "types", "functions"])),
    { conceptIds: [], estimatedMinutes: 0 },
  );
});

test("rejects unknown concepts and edges that point outside the graph", () => {
  assert.throws(() => getShortestLearningPath("missing", concepts, edges, new Set()), /does not exist/);
  assert.throws(
    () => getUnlockStates(concepts, [...edges, { conceptId: "functions", prerequisiteId: "ghost" }], new Set()),
    /same graph/,
  );
});
