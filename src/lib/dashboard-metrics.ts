export type LessonCompletion = {
  completedAt: Date;
  durationMinutes: number;
};

export type MonthlyLearning = {
  month: string;
  minutes: number;
};

export function getMonthlyLearningMinutes(
  completions: LessonCompletion[],
  now = new Date(),
): MonthlyLearning[] {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1),
    );
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en", {
      month: "short",
      timeZone: "UTC",
    }).format(date);
    return { key, label, minutes: 0 };
  });
  const byMonth = new Map(months.map((month) => [month.key, month]));

  for (const completion of completions) {
    const key = `${completion.completedAt.getUTCFullYear()}-${String(completion.completedAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = byMonth.get(key);
    if (month) month.minutes += completion.durationMinutes;
  }

  return months.map(({ label, minutes }) => ({ month: label, minutes }));
}

export function getCurrentLearningStreak(
  activityDates: Date[],
  now = new Date(),
): number {
  const dayMilliseconds = 24 * 60 * 60 * 1000;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const activeDays = new Set(
    activityDates.map((date) =>
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    ),
  );
  let cursor = activeDays.has(today) ? today : today - dayMilliseconds;
  let streak = 0;

  while (activeDays.has(cursor)) {
    streak += 1;
    cursor -= dayMilliseconds;
  }

  return streak;
}
