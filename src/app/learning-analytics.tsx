"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyLearning } from "@/lib/dashboard-metrics";

export function LearningAnalytics({
  monthlyLearning,
  masteredCount,
  conceptCount,
}: {
  monthlyLearning: MonthlyLearning[];
  masteredCount: number;
  conceptCount: number;
}) {
  const remainingCount = Math.max(conceptCount - masteredCount, 0);
  const masteryPercent = conceptCount
    ? Math.round((masteredCount / conceptCount) * 100)
    : 0;

  return (
    <section
      className="grid gap-4 rounded-[24px] border border-white/[0.08] bg-[#2b245f] p-5 shadow-[0_18px_48px_rgba(8,5,30,0.18)] lg:grid-cols-[minmax(0,1.55fr)_minmax(200px,0.8fr)] lg:p-6"
      id="my-progress"
    >
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Learning analytics</h2>
            <p className="mt-1 text-[11px] text-white/45">
              Study time from completed lessons, by month
            </p>
          </div>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[9px] font-semibold text-white/45">
            LAST 6 MONTHS
          </span>
        </div>
        <div className="mt-4 h-[190px] w-full">
          {monthlyLearning.length ? (
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart
                data={monthlyLearning}
                margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
              >
                <defs>
                  <linearGradient id="learningFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#a895ff" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#a895ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff12" strokeDasharray="4 5" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="month"
                  tick={{ fill: "#aaa4ca", fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: "#aaa4ca", fontSize: 9 }}
                  tickLine={false}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    background: "#211b4e",
                    border: "1px solid #ffffff20",
                    borderRadius: 12,
                    color: "#fff",
                    fontSize: 11,
                  }}
                  formatter={(value) => [`${Number(value)} min`, "Study time"]}
                  labelStyle={{ color: "#cfc8f5", marginBottom: 4 }}
                />
                <Area
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#c5b7ff" }}
                  dataKey="minutes"
                  fill="url(#learningFill)"
                  stroke="#aa99ff"
                  strokeWidth={2.5}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-white/40">
              No completed lesson history yet.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-center border-t border-white/[0.08] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <p className="text-[11px] font-semibold text-white/50">Concept mastery</p>
        <div className="mt-4 flex items-center gap-4">
          <div
            aria-label={`${masteryPercent}% of concepts mastered`}
            className="relative flex h-[94px] w-[94px] shrink-0 items-center justify-center rounded-full"
            role="img"
            style={{
              background: `conic-gradient(#62d8ae ${masteryPercent}%, #ffffff18 ${masteryPercent}% 100%)`,
            }}
          >
            <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-[#2b245f]">
              <span className="text-lg font-bold text-white">{masteryPercent}%</span>
              <span className="text-[8px] uppercase tracking-wide text-white/40">mastered</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-[10px]">
                <span className="text-white/60">Completed</span>
                <span className="font-bold text-emerald-200">{masteredCount}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#62d8ae]"
                  style={{ width: `${masteryPercent}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px]">
                <span className="text-white/60">Remaining</span>
                <span className="font-bold text-violet-200">{remainingCount}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#9888f5]"
                  style={{
                    width: `${conceptCount ? (remainingCount / conceptCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-[10px] leading-4 text-white/35">
          Mastery reflects quiz attempts against each instructor&apos;s current passing threshold.
        </p>
      </div>
    </section>
  );
}
