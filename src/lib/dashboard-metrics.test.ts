import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurrentLearningStreak,
  getMonthlyLearningMinutes,
} from "./dashboard-metrics";

test("groups actual completed lesson time into the last six calendar months", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");
  const months = getMonthlyLearningMinutes(
    [
      { completedAt: new Date("2026-11-02T10:00:00.000Z"), durationMinutes: 25 },
      { completedAt: new Date("2026-11-13T10:00:00.000Z"), durationMinutes: 35 },
      { completedAt: new Date("2026-03-30T10:00:00.000Z"), durationMinutes: 90 },
    ],
    now,
  );

  assert.deepEqual(months, [
    { month: "Jun", minutes: 0 },
    { month: "Jul", minutes: 0 },
    { month: "Aug", minutes: 0 },
    { month: "Sep", minutes: 0 },
    { month: "Oct", minutes: 0 },
    { month: "Nov", minutes: 60 },
  ]);
});

test("counts consecutive active days through today or yesterday", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");
  assert.equal(
    getCurrentLearningStreak(
      [
        new Date("2026-11-18T08:00:00.000Z"),
        new Date("2026-11-17T08:00:00.000Z"),
        new Date("2026-11-16T08:00:00.000Z"),
        new Date("2026-11-14T08:00:00.000Z"),
      ],
      now,
    ),
    3,
  );
  assert.equal(
    getCurrentLearningStreak(
      [new Date("2026-11-16T08:00:00.000Z")],
      now,
    ),
    0,
  );
});
