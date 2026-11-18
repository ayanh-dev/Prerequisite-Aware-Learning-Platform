import { ArrowLeft, Code2 } from "lucide-react";
import Link from "next/link";
import { AuthForm } from "../auth-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#211b4e] px-4 py-10 text-white">
      <div className="w-full max-w-[440px] rounded-[28px] border border-white/10 bg-[#2c255f] p-7 shadow-[0_30px_90px_rgba(8,5,30,0.35)] sm:p-9">
        <Link className="mb-9 inline-flex items-center gap-2 text-xs font-semibold text-white/55 transition hover:text-white" href="/login">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8973f0] text-[#20194d]">
          <Code2 size={23} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8adff]">
          PATHWISE LEARNING
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Create learner account</h1>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Your account and learning data stay in this local SQLite database.
        </p>
        <AuthForm mode="register" />
        <p className="mt-5 text-center text-xs text-white/50">
          Already registered?{" "}
          <Link className="font-semibold text-violet-200 hover:text-white" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
