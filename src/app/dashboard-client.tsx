"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Flame,
  Home,
  LockKeyhole,
  LogOut,
  Map as MapIcon,
  Play,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  signOutAction,
} from "./actions";
import { LearningAnalytics } from "./learning-analytics";
import { LearningGraph } from "./learning-graph";
import type {
  DashboardActivity,
  DashboardCourse,
  DashboardData,
} from "@/lib/dashboard-data";

const navigation = [
  { label: "Overview", href: "#overview", icon: Home },
  { label: "My Courses", href: "#my-courses", icon: BookOpen },
  { label: "Learning Graph", href: "#learning-graph", icon: Activity },
  { label: "Learning Path", href: "#learning-path", icon: MapIcon },
  { label: "Assessments", href: "#assessments", icon: ShieldCheck },
  { label: "My Progress", href: "#my-progress", icon: Target },
  { label: "Notifications", href: "#notifications", icon: Bell },
];

const courseGradients = [
  "from-[#8170ec] to-[#5143aa]",
  "from-[#398b98] to-[#315d78]",
  "from-[#b681d4] to-[#6e55a8]",
];

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function openConcept(conceptId: string, setSelectedConceptId: (id: string) => void) {
  setSelectedConceptId(conceptId);
  document
    .getElementById("learning-graph")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function CourseCard({
  course,
  index,
  selected,
  onSelect,
}: {
  course: DashboardCourse;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const gradient = courseGradients[index % courseGradients.length];

  return (
    <article
      className={`overflow-hidden rounded-[20px] border transition ${
        selected
          ? "border-violet-300/30 bg-[#322a70] shadow-[0_12px_30px_rgba(7,5,28,0.18)]"
          : "border-white/[0.08] bg-[#2b245f] hover:border-white/20"
      }`}
    >
      <div className={`relative flex h-[112px] items-center justify-between overflow-hidden bg-gradient-to-br ${gradient} px-5`}>
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white/85">
            <Code2 size={10} /> {course.concepts.length} concepts
          </span>
          <p className="mt-3 max-w-[190px] text-sm font-bold leading-5 text-white">
            {course.title}
          </p>
        </div>
        <div aria-hidden="true" className="absolute -right-4 -top-8 h-36 w-36 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -right-1 top-4 h-24 w-24 rounded-full border border-white/15" />
        <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white backdrop-blur">
          {course.slug.toLowerCase().includes("c-programming") ? (
            <Code2 size={23} />
          ) : (
            <BookOpen size={22} />
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between text-[10px]">
          <span className="text-white/45">Mastery progress</span>
          <span className="font-bold text-white">{course.progressPercent}%</span>
        </div>
        <div
          aria-label={`${course.masteredCount} of ${course.concepts.length} concepts mastered`}
          aria-valuemax={course.concepts.length}
          aria-valuemin={0}
          aria-valuenow={course.masteredCount}
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#b3a5ff] to-[#69d6b1]"
            style={{ width: `${course.progressPercent}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[9px] text-white/40">
            {course.masteredCount}/{course.concepts.length} mastered
          </span>
          <button
            className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-200 transition hover:text-white"
            onClick={onSelect}
            type="button"
          >
            {selected ? "Currently viewing" : "Open course"}
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ActivityRow({
  activity,
  onOpen,
}: {
  activity: DashboardActivity;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        activity.kind === "quiz"
          ? "bg-violet-400/10 text-violet-200"
          : "bg-emerald-300/10 text-emerald-200"
      }`}>
        {activity.kind === "quiz" ? <Award size={16} /> : <Check size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-white/85">
          {activity.kind === "quiz" ? "Quiz attempt" : "Lesson completed"} · {activity.conceptTitle}
        </p>
        <p className="mt-1 truncate text-[9px] text-white/40">
          {activity.courseTitle} · {formatDate(activity.timestamp)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {activity.score !== null && (
          <span
            className={`rounded-full px-2 py-1 text-[9px] font-bold ${
              activity.passed
                ? "bg-emerald-300/10 text-emerald-200"
                : "bg-amber-300/10 text-amber-100"
            }`}
          >
            {activity.score}%
          </span>
        )}
        <button
          aria-label={`View ${activity.conceptTitle} in the learning graph`}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
          onClick={onOpen}
          type="button"
        >
          <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const course =
    data.courses.find((item) => item.id === data.selectedCourseId) ?? data.courses[0];
  const initialConceptId =
    data.learningPath.conceptIds[0] ?? course.concepts[0]?.id ?? null;
  const [selectedConceptId, setSelectedConceptId] = useState(initialConceptId);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConcepts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return course.concepts.filter(
      (concept) =>
        !query ||
        concept.title.toLocaleLowerCase().includes(query) ||
        concept.description.toLocaleLowerCase().includes(query),
    );
  }, [course.concepts, searchQuery]);
  const nextConcept =
    course.concepts.find((concept) => concept.id === data.learningPath.conceptIds[0]) ??
    course.concepts.find((concept) => concept.status === "unlocked");
  const learnerView = data.profile.role === "LEARNER";
  const displayName = data.profile.name.trim() || data.profile.email;
  const roleLabel = learnerView ? "Learner workspace" : "Instructor workspace";

  function selectCourse(courseId: string) {
    router.push(`/?course=${encodeURIComponent(courseId)}`);
  }

  function inspectConcept(conceptId: string) {
    openConcept(conceptId, setSelectedConceptId);
  }

  return (
    <main className="min-h-screen bg-[#241d55] text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-white/[0.08] bg-[#1d174a] px-4 py-5 xl:flex">
        <a className="mb-8 flex items-center gap-3 px-2" href="#overview">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#af9dff] to-[#8270ed] text-[#211a50] shadow-[0_7px_20px_rgba(132,112,237,0.3)]">
            <Code2 size={21} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-[18px] font-bold tracking-[-0.04em] text-white">
              pathwise
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-[#a39bc8]">
              Learn with direction
            </span>
          </span>
        </a>

        <div className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.17em] text-[#817aa7]">
          Learning space
        </div>
        <nav aria-label="Main navigation" className="space-y-1">
          {navigation.map(({ label, href, icon: Icon }, index) => (
            <a
              key={label}
              aria-current={index === 0 ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition-all ${
                index === 0
                  ? "bg-[#8270ed]/20 text-[#d3caff] shadow-[inset_0_0_0_1px_rgba(178,162,255,0.12)]"
                  : "text-[#aaa5c5] hover:bg-white/[0.06] hover:text-white"
              }`}
              href={href}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span className="flex-1">{label}</span>
              {label === "Notifications" && data.notifications.length > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#9a85ff] px-1 text-[8px] font-bold text-[#211a50]">
                  {data.notifications.length}
                </span>
              )}
              {label === "My Courses" && (
                <span className="text-[9px] text-white/35">{data.courses.length}</span>
              )}
            </a>
          ))}
        </nav>

        <a
          className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-[#aaa5c5] transition hover:bg-white/[0.06] hover:text-white"
          href="#settings"
        >
          <Settings size={16} strokeWidth={1.8} /> Settings
        </a>

        <div className="mt-auto rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#342c71] to-[#29225b] p-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#9a85ff]/15 text-[#c8bcff]">
            <Sparkles size={16} />
          </span>
          <p className="mt-3 text-[11px] font-bold text-white">A smarter way forward</p>
          <p className="mt-1 text-[9px] leading-4 text-white/45">
            Follow the foundations. Master the next big idea.
          </p>
          <a className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold text-[#c7bcff]" href="#learning-path">
            See your next steps <ArrowRight size={12} />
          </a>
        </div>

        <a
          className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.035] p-2.5 transition hover:bg-white/[0.07]"
          href="#profile"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#d2c8ff] to-[#8979e7] text-[10px] font-bold text-[#29215e]">
            {getInitials(displayName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10px] font-bold text-white/90">{displayName}</span>
            <span className="block text-[9px] text-white/40">{roleLabel}</span>
          </span>
          <ChevronDown size={14} className="text-white/40" />
        </a>
      </aside>

      <div className="xl:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#241d55]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[66px] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-9">
            <a className="flex shrink-0 items-center gap-2.5 xl:hidden" href="#overview">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#af9dff] to-[#8270ed] text-[#211a50]">
                <Code2 size={18} />
              </span>
              <span className="text-sm font-bold tracking-tight text-white">pathwise</span>
            </a>
            <div className="hidden items-center gap-2 text-[10px] text-white/40 sm:flex">
              <span>{roleLabel}</span>
              <ChevronRight size={13} />
              <span className="font-semibold text-white/75">Dashboard</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <label className="hidden h-9 min-w-[210px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 md:flex">
                <Search size={14} className="shrink-0 text-white/40" />
                <input
                  aria-label="Search concepts"
                  className="min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/35"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search concepts..."
                  value={searchQuery}
                />
                {searchQuery && (
                  <button
                    aria-label="Clear concept search"
                    className="text-white/40 hover:text-white"
                    onClick={() => setSearchQuery("")}
                    type="button"
                  >
                    ×
                  </button>
                )}
              </label>
              <a
                aria-label={`Notifications${data.notifications.length ? `, ${data.notifications.length} unread` : ""}`}
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/65 transition hover:bg-white/[0.08] hover:text-white"
                href="#notifications"
              >
                <Bell size={17} />
                {data.notifications.length > 0 && (
                  <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#79dfb9]" />
                )}
              </a>
              <div className="hidden items-center gap-2 border-l border-white/10 pl-3 sm:flex" id="profile">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#d2c8ff] to-[#8979e7] text-[10px] font-bold text-[#29215e]">
                  {getInitials(displayName)}
                </span>
                <span className="max-w-[150px]">
                  <span className="block truncate text-[10px] font-semibold text-white/90">{displayName}</span>
                  <span className="block text-[9px] text-white/40">{data.profile.role.toLowerCase()}</span>
                </span>
              </div>
            </div>
          </div>
          <nav aria-label="Mobile navigation" className="flex gap-1 overflow-x-auto border-t border-white/[0.06] px-3 py-2 xl:hidden">
            {navigation.map(({ label, href, icon: Icon }, index) => (
              <a
                key={label}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[9px] font-semibold ${
                  index === 0 ? "bg-violet-300/15 text-violet-100" : "text-white/50"
                }`}
                href={href}
              >
                <Icon size={13} />
                {label}
              </a>
            ))}
            <a className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[9px] font-semibold text-white/50" href="#settings">
              <Settings size={13} /> Settings
            </a>
          </nav>
          <div className="px-4 pb-2 md:hidden">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3">
              <Search size={14} className="text-white/40" />
              <input
                aria-label="Search concepts"
                className="min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/35"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search concepts..."
                value={searchQuery}
              />
            </label>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-7 sm:pt-8 lg:px-9 lg:pt-9">
          <section id="overview" className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold text-[#c7bded]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#63d8b0]" />
                {roleLabel}
              </div>
              <h1 className="text-[25px] font-bold tracking-[-0.045em] text-white sm:text-[30px]">
                Welcome back, {displayName.split(" ")[0]}
              </h1>
              <p className="mt-1.5 text-xs text-white/45">
                {learnerView
                  ? "Your learning path is ready. Let’s keep the momentum going."
                  : "See how your curriculum is guiding learners forward."}
              </p>
            </div>
            <label className="relative flex h-9 min-w-[190px] items-center rounded-xl border border-white/[0.1] bg-[#2b245f] px-3 text-[10px] text-white/60">
              <BookOpen size={14} className="mr-2 text-violet-200" />
              <select
                aria-label="Select course"
                className="w-full appearance-none bg-transparent pr-5 font-semibold text-white/80 outline-none"
                onChange={(event) => selectCourse(event.target.value)}
                value={course.id}
              >
                {data.courses.map((item) => (
                  <option className="bg-[#2b245f]" key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 text-white/40" size={13} />
            </label>
          </section>

          <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              {
                label: "Learning time",
                value: formatDuration(data.totalLearningMinutes),
                note: "completed lessons",
                icon: Clock3,
                tone: "text-sky-200 bg-sky-300/10",
              },
              {
                label: "Course completion",
                value: `${course.progressPercent}%`,
                note: `${course.masteredCount} concepts mastered`,
                icon: Activity,
                tone: "text-violet-200 bg-violet-300/10",
              },
              {
                label: "Concepts mastered",
                value: `${course.masteredCount}/${course.concepts.length}`,
                note: "current course",
                icon: Award,
                tone: "text-emerald-200 bg-emerald-300/10",
              },
              {
                label: learnerView ? "Learning streak" : "Learners enrolled",
                value: learnerView
                  ? `${data.streakDays} ${data.streakDays === 1 ? "day" : "days"}`
                  : course.learnerCount.toString(),
                note: learnerView ? "based on recent activity" : "learners enrolled",
                icon: learnerView ? Flame : Users,
                tone: learnerView
                  ? "text-amber-200 bg-amber-300/10"
                  : "text-sky-200 bg-sky-300/10",
              },
            ].map(({ label, value, note, icon: Icon, tone }) => (
              <article
                className="rounded-[20px] border border-white/[0.08] bg-[#2b245f] p-4 shadow-[0_12px_32px_rgba(8,5,30,0.12)] sm:p-5"
                key={label}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-medium text-white/45">{label}</p>
                    <p className="mt-2 text-[23px] font-bold tracking-[-0.04em] text-white">{value}</p>
                  </div>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
                    <Icon size={17} />
                  </span>
                </div>
                <p className="mt-2 truncate text-[9px] text-white/35">{note}</p>
              </article>
            ))}
          </section>

          <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(315px,0.78fr)]">
            <div className="min-w-0 space-y-5">
              <section id="my-courses">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">My Courses</h2>
                    <p className="mt-1 text-[10px] text-white/40">
                      {data.courses.length} {data.courses.length === 1 ? "course" : "courses"} from your PathWise profile
                    </p>
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">
                    {data.profile.role === "INSTRUCTOR" ? "Created by you" : "Enrolled"}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {data.courses.map((item, index) => (
                    <CourseCard
                      course={item}
                      index={index}
                      key={item.id}
                      onSelect={() => selectCourse(item.id)}
                      selected={item.id === course.id}
                    />
                  ))}
                </div>
              </section>

              <LearningGraph
                course={course}
                key={course.id}
                onSelectConcept={setSelectedConceptId}
                searchQuery={searchQuery}
                selectedConceptId={selectedConceptId}
              />

              <section
                className="rounded-[24px] border border-white/[0.08] bg-[#2b245f] p-5 shadow-[0_14px_38px_rgba(8,5,30,0.14)] sm:p-6"
                id="concepts"
              >
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">Course concepts</h2>
                    <p className="mt-1 text-[10px] text-white/40">
                      {filteredConcepts.length} of {course.concepts.length} concepts
                      {searchQuery ? " match your search" : " in this curriculum"}
                    </p>
                  </div>
                </div>
                {filteredConcepts.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredConcepts.map((concept) => (
                      <button
                        className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition hover:border-violet-200/20 hover:bg-white/[0.06]"
                        key={concept.id}
                        onClick={() => inspectConcept(concept.id)}
                        type="button"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          concept.status === "mastered"
                            ? "bg-emerald-300/10 text-emerald-200"
                            : concept.status === "unlocked"
                              ? "bg-violet-300/10 text-violet-200"
                              : "bg-white/[0.06] text-white/40"
                        }`}>
                          {concept.status === "mastered" ? (
                            <Check size={14} />
                          ) : concept.status === "unlocked" ? (
                            <Play size={12} />
                          ) : (
                            <LockKeyhole size={13} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-semibold text-white/85">
                            {concept.title}
                          </span>
                          <span className="mt-1 block truncate text-[9px] text-white/40">
                            {concept.status === "locked"
                              ? `Requires ${concept.missingPrerequisiteTitles.join(", ")}`
                              : `${formatDuration(concept.durationMinutes)} · ${concept.status}`}
                          </span>
                        </span>
                        <ChevronRight size={13} className="shrink-0 text-white/30" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[10px] text-white/45">
                    No concepts match “{searchQuery}”.
                  </p>
                )}
              </section>

              <LearningAnalytics
                conceptCount={course.concepts.length}
                masteredCount={course.masteredCount}
                monthlyLearning={data.monthlyLearning}
              />

              <section
                className="rounded-[24px] border border-white/[0.08] bg-[#2b245f] p-5 shadow-[0_18px_48px_rgba(8,5,30,0.15)] sm:p-6"
                id="assessments"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Recent learning</h2>
                    <p className="mt-1 text-[10px] text-white/40">
                      Completed lessons and quiz attempts from your account
                    </p>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[9px] font-semibold text-white/45">
                    {data.recentActivity.length} activities
                  </span>
                </div>
                {data.recentActivity.length ? (
                  <div className="divide-y divide-white/[0.07]">
                    {data.recentActivity.map((activity) => (
                      <ActivityRow
                        activity={activity}
                        key={activity.id}
                        onOpen={() => inspectConcept(activity.conceptId)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
                    <p className="text-xs font-semibold text-white/65">No learning activity yet</p>
                    <p className="mt-1 text-[10px] text-white/35">
                      Completed lessons and quiz attempts will appear here.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <aside className="min-w-0 space-y-5">
              <section
                className="overflow-hidden rounded-[24px] border border-violet-200/10 bg-gradient-to-br from-[#483b91] via-[#342a75] to-[#2a235e] shadow-[0_18px_48px_rgba(8,5,30,0.2)]"
                id="learning-path"
              >
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-violet-100">
                        <MapIcon size={16} />
                      </span>
                      <h2 className="text-sm font-bold text-white">
                        {learnerView ? "Your learning path" : "Learner roadmap"}
                      </h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-violet-100/70">
                      {learnerView ? "Recommended" : "Instructor view"}
                    </span>
                  </div>
                  {!learnerView ? (
                    <p className="mt-3 text-[10px] leading-5 text-white/55">
                      Personalized learning paths are calculated for each learner. Inspect their prerequisite routes in the course graph.
                    </p>
                  ) : data.learningPath.targetConceptId ? (
                    <p className="mt-3 text-[10px] leading-5 text-white/55">
                      Shortest prerequisite route to{" "}
                      <strong className="font-bold text-white">
                        {course.concepts.find((item) => item.id === data.learningPath.targetConceptId)?.title}
                      </strong>
                    </p>
                  ) : (
                    <p className="mt-3 text-[10px] leading-5 text-white/55">
                      No learning path is available until this course has active concepts.
                    </p>
                  )}
                  {data.learningPath.conceptIds.length > 0 && (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-black/10 px-3 py-2.5">
                      <span className="text-[10px] font-medium text-white/55">Estimated time</span>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white/90">
                        <Clock3 size={12} />
                        {formatDuration(data.learningPath.estimatedMinutes)}
                      </span>
                    </div>
                  )}
                </div>
                {data.learningPath.conceptIds.length ? (
                  <ol className="space-y-0 px-5 py-2">
                    {data.learningPath.conceptIds.map((id, index) => {
                      const concept = course.concepts.find((item) => item.id === id);
                      if (!concept) return null;

                      return (
                        <li className="relative flex gap-3 py-3" key={id}>
                          {index < data.learningPath.conceptIds.length - 1 && (
                            <span className="absolute bottom-[-2px] left-[14px] top-[42px] w-px bg-white/15" />
                          )}
                          <span className={`relative z-10 flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${
                            concept.status === "unlocked"
                              ? "border-violet-200/40 bg-violet-200/15 text-violet-100"
                              : "border-white/15 bg-white/[0.05] text-white/55"
                          }`}>
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 pt-0.5">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-[11px] font-bold text-white/90">{concept.title}</span>
                              <span className="shrink-0 text-[9px] text-white/45">
                                {concept.durationMinutes}m
                              </span>
                            </span>
                            <span className="mt-1 block text-[9px] text-white/40">
                              {concept.status === "unlocked"
                                ? "Ready to begin"
                                : `Unlocks after ${concept.missingPrerequisiteTitles.join(", ") || "prerequisites"}`}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="px-5 py-6 text-center text-[10px] text-white/45">
                    {learnerView
                      ? "All available concepts are mastered."
                      : "Select a learner to view a personalized learning path."}
                  </div>
                )}
                {nextConcept && (
                  <div className="px-5 pb-5">
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b1a3ff] py-3 text-[10px] font-bold text-[#28205d] transition hover:bg-[#c7bdff]"
                      onClick={() => inspectConcept(nextConcept.id)}
                      type="button"
                    >
                      {learnerView ? "View recommended concept" : "Inspect curriculum"} <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-[24px] border border-white/[0.08] bg-[#2b245f] p-5 shadow-[0_14px_38px_rgba(8,5,30,0.14)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Upcoming goals</h2>
                    <p className="mt-1 text-[10px] text-white/40">Your next concepts in this course</p>
                  </div>
                  <Target size={16} className="text-violet-200" />
                </div>
                <div className="space-y-2.5">
                  {course.concepts
                    .filter((concept) => concept.status !== "mastered")
                    .slice(0, 4)
                    .map((concept) => (
                      <button
                        className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 text-left transition hover:border-violet-200/20 hover:bg-white/[0.06]"
                        key={concept.id}
                        onClick={() => inspectConcept(concept.id)}
                        type="button"
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          concept.status === "unlocked"
                            ? "bg-violet-300/10 text-violet-200"
                            : "bg-white/[0.06] text-white/40"
                        }`}>
                          {concept.status === "unlocked" ? <Play size={11} /> : <LockKeyhole size={12} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-semibold text-white/80">{concept.title}</span>
                          <span className="mt-0.5 block truncate text-[8px] text-white/35">
                            {concept.status === "locked"
                              ? `Needs ${concept.missingPrerequisiteTitles.join(", ")}`
                              : `${concept.durationMinutes} min · unlocked`}
                          </span>
                        </span>
                        <ChevronRight size={13} className="text-white/30" />
                      </button>
                    ))}
                  {!course.concepts.some((concept) => concept.status !== "mastered") && (
                    <p className="rounded-xl bg-white/[0.04] p-3 text-[10px] text-white/45">
                      This course is complete. You have mastered every active concept.
                    </p>
                  )}
                </div>
              </section>

              <section
                className="rounded-[24px] border border-white/[0.08] bg-[#2b245f] p-5 shadow-[0_14px_38px_rgba(8,5,30,0.14)]"
                id="notifications"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-200/10 text-amber-100">
                      <Bell size={15} />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-white">Updates</h2>
                      <p className="mt-0.5 text-[9px] text-white/40">Curriculum changes for your courses</p>
                    </div>
                  </div>
                  {data.notifications.length > 0 && (
                    <form action={markAllNotificationsRead}>
                      <button className="text-[9px] font-semibold text-violet-200 transition hover:text-white" type="submit">
                        Mark all read
                      </button>
                    </form>
                  )}
                </div>
                {data.notifications.length ? (
                  <div className="space-y-2">
                    {data.notifications.map((notification) => (
                      <article className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3" key={notification.id}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[10px] font-bold text-white/85">{notification.title}</p>
                          <span className="shrink-0 text-[8px] text-white/35">{formatDate(notification.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-[9px] leading-4 text-white/50">{notification.message}</p>
                        <form action={markNotificationRead} className="mt-2 text-right">
                          <input name="notificationId" type="hidden" value={notification.id} />
                          <button className="text-[9px] font-semibold text-violet-200 hover:text-white" type="submit">
                            Mark read
                          </button>
                        </form>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[10px] text-white/40">
                    You&apos;re all caught up. Curriculum updates will appear here.
                  </p>
                )}
              </section>

              <section
                className="rounded-[24px] border border-white/[0.08] bg-[#2b245f] p-5"
                id="settings"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-white/70">
                    <Settings size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-bold text-white">Account & settings</h2>
                    <p className="mt-0.5 text-[9px] text-white/40">Managed by your PathWise account</p>
                  </div>
                </div>
                <div className="space-y-2 rounded-xl bg-black/10 p-3 text-[9px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/40">Email</span>
                    <span className="truncate text-white/75">{data.profile.email}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-white/40">Role</span>
                    <span className="text-white/75">{data.profile.role}</span>
                  </div>
                </div>
                <form action={signOutAction} className="mt-3">
                  <button className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] font-semibold text-rose-200/80 transition hover:bg-rose-300/10 hover:text-rose-100" type="submit">
                    <LogOut size={13} /> Sign out
                  </button>
                </form>
              </section>
            </aside>
          </div>

          <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4 text-[9px] text-white/35">
            <span>PathWise · Learn the right thing at the right time.</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#62d8ae]" />
              Signed in as {data.profile.email}
            </span>
          </footer>
        </div>
      </div>
    </main>
  );
}
