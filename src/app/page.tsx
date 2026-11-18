import { Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  Code2,
  Database,
  GraduationCap,
  LockKeyhole,
} from "lucide-react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { CourseCatalog } from "./course-catalog";
import { signOutAction } from "./actions";
import { loadDashboardData } from "@/lib/dashboard-data";
import { getCurrentUser } from "@/lib/auth";

type HomeProps = {
  searchParams: Promise<{ course?: string | string[] }>;
};

function PageLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#241d55] px-4 text-white">
      <div className="flex items-center gap-3 text-sm text-white/65">
        <span className="h-2 w-2 animate-pulse rounded-full bg-violet-300" />
        Loading your PathWise workspace…
      </div>
    </main>
  );
}

function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#241d55] px-4 py-10 text-white">
      <section className="w-full max-w-[560px] rounded-[28px] border border-white/10 bg-[#2b245f] p-7 shadow-[0_30px_90px_rgba(8,5,30,0.35)] sm:p-9">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#af9dff] to-[#8270ed] text-[#211a50]">
          <Code2 size={23} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
          PATHWISE SETUP
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Connect your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-white/55">
          PathWise stores courses and learning history in a local SQLite database on this Mac.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <Database size={17} className="text-violet-200" />
            <p className="mt-2 text-xs font-bold text-white/85">Database</p>
            <p className="mt-1 text-[10px] leading-4 text-white/45">Prisma + local SQLite file</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <LockKeyhole size={17} className="text-emerald-200" />
            <p className="mt-2 text-xs font-bold text-white/85">Session</p>
            <p className="mt-1 text-[10px] leading-4 text-white/45">Local password session</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.04] p-4">
          <p className="text-xs font-bold text-amber-100">Missing local environment values</p>
          <p className="mt-1 text-[10px] leading-5 text-white/50">
            Copy <code>.env.example</code> to <code>.env</code>, set the local database path, then restart <code>npm run dev</code>.
          </p>
          <ul className="mt-3 grid gap-1 text-[10px] text-amber-100/80 sm:grid-cols-2">
            {missing.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </div>
      </section>
    </main>
  );
}

function ProfileRequired({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#241d55] px-4 py-10 text-white">
      <section className="w-full max-w-[500px] rounded-[28px] border border-white/10 bg-[#2b245f] p-8 text-center shadow-[0_30px_90px_rgba(8,5,30,0.35)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-300/10 text-violet-200">
          <LockKeyhole size={21} />
        </div>
        <h1 className="mt-5 text-xl font-bold">PathWise profile not found</h1>
        <p className="mt-2 text-xs leading-5 text-white/55">
          {email
            ? `The signed-in email ${email} is not linked to a PathWise profile.`
            : "The signed-in account could not be found."}
          {" "}Sign out and try again.
        </p>
        <form action={signOutAction} className="mt-6">
          <button className="rounded-xl bg-[#9a85ff] px-4 py-2.5 text-xs font-bold text-[#211a50] transition hover:bg-[#b2a4ff]" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}

function NoCourses({ name, role }: { name: string; role: "LEARNER" | "INSTRUCTOR" }) {
  const isLearner = role === "LEARNER";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#241d55] px-4 py-10 text-white">
      <section className="w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#2b245f] p-8 text-center shadow-[0_30px_90px_rgba(8,5,30,0.35)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-300/10 text-violet-200">
          {isLearner ? <BookOpen size={21} /> : <GraduationCap size={22} />}
        </div>
        <h1 className="mt-5 text-xl font-bold">Welcome, {name}</h1>
        <p className="mt-2 text-xs leading-5 text-white/55">
          {isLearner
            ? "Choose a course to add it to your learning dashboard and start building mastery."
            : "No courses are assigned to your instructor profile yet. Courses you create will appear here when they are connected to your account."}
        </p>
        {isLearner && <CourseCatalog />}
        <form action={signOutAction} className="mt-6">
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white" type="submit">
            Sign out <ArrowRight size={13} />
          </button>
        </form>
      </section>
    </main>
  );
}

async function DashboardRequest({ searchParams }: HomeProps) {
  await connection();
  const authUser = await getCurrentUser();
  if (!authUser) {
    redirect("/login");
  }

  const params = await searchParams;
  const requestedCourseId =
    typeof params.course === "string" ? params.course : undefined;
  const result = await loadDashboardData(authUser, requestedCourseId);

  if (result.kind === "profile-missing") {
    return <ProfileRequired email={result.email} />;
  }
  if (result.kind === "no-courses") {
    return <NoCourses name={result.profile.name} role={result.profile.role} />;
  }

  return <DashboardClient data={result.data} key={result.data.selectedCourseId} />;
}

export default function Home(props: HomeProps) {
  const missing = process.env.DATABASE_URL ? [] : ["DATABASE_URL"];
  if (missing.length) {
    return <SetupRequired missing={missing} />;
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <DashboardRequest searchParams={props.searchParams} />
    </Suspense>
  );
}
