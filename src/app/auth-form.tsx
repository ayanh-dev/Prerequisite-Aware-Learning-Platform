"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AuthResponse = {
  error?: string;
};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      ...(isRegister ? { name: formData.get("name") } : {}),
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as AuthResponse;
      if (!response.ok) {
        setErrorMessage(result.error ?? "The request could not be completed.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The local server could not be reached.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={submit}>
      {isRegister && (
        <label className="block text-xs font-semibold text-[#d9d4f4]" htmlFor="name">
          Name
          <input
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-[#a78bfa] focus:ring-2 focus:ring-[#8b5cf6]/30"
            id="name"
            maxLength={80}
            minLength={2}
            name="name"
            required
          />
        </label>
      )}
      <label className="block text-xs font-semibold text-[#d9d4f4]" htmlFor="email">
        Email
        <input
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-[#a78bfa] focus:ring-2 focus:ring-[#8b5cf6]/30"
          id="email"
          maxLength={254}
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block text-xs font-semibold text-[#d9d4f4]" htmlFor="password">
        Password
        <input
          autoComplete={isRegister ? "new-password" : "current-password"}
          className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-[#a78bfa] focus:ring-2 focus:ring-[#8b5cf6]/30"
          id="password"
          maxLength={128}
          minLength={isRegister ? 12 : 1}
          name="password"
          required
          type="password"
        />
        {isRegister && (
          <span className="mt-1 block text-[10px] font-normal text-white/40">
            Use 12–128 characters.
          </span>
        )}
      </label>
      {errorMessage && (
        <p aria-live="polite" className="rounded-xl bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          {errorMessage}
        </p>
      )}
      <button
        className="w-full rounded-xl bg-[#9a85ff] px-4 py-3 text-sm font-bold text-[#211b4f] transition hover:bg-[#b2a4ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting
          ? "Please wait…"
          : isRegister
            ? "Create learner account"
            : "Sign in"}
      </button>
    </form>
  );
}
