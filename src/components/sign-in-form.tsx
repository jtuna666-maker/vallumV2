"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2, LogIn, Mail, ShieldCheck } from "lucide-react";

type Step = "email" | "code";

export default function SignInForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; devCode?: string; delivered?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the code");
      setDevCode(data.devCode ?? null);
      setDelivered(Boolean(data.delivered));
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="grain relative flex min-h-screen items-center justify-center bg-paper px-5 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-ink text-paper shadow-lift">
            <BookOpen className="size-6" strokeWidth={1.6} />
          </span>
          <h1 className="display mt-6 text-4xl font-medium tracking-tight">Welcome back,</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {step === "email"
              ? "Sign in with your email — we'll send a six-digit code, no passwords to forget."
              : `We sent a code to ${email}. It expires in ten minutes.`}
          </p>
        </div>

        <div className="shadow-book mt-8 rounded-2xl border border-line bg-vellum p-8">
          {step === "email" ? (
            <form onSubmit={requestCode} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[0.68rem] font-semibold tracking-wide text-ink-soft">
                  EMAIL
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="email"
                    required
                    autoFocus
                    className="field pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              {error && <p className="text-xs text-oxblood">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-paper transition hover:bg-bronze-deep disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {busy ? "Sending…" : "Email me a sign-in code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[0.68rem] font-semibold tracking-wide text-ink-soft">
                  SIX-DIGIT CODE
                </label>
                <input
                  required
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  className="field text-center text-2xl font-semibold tracking-[0.5em]"
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              {devCode && (
                <p className="rounded-lg border border-bronze/30 bg-bronze/10 px-3.5 py-2.5 text-center text-[0.72rem] font-medium text-bronze-deep">
                  Dev mode (no email configured) — your code is <strong className="tracking-widest">{devCode}</strong>
                </p>
              )}
              {!devCode && delivered && (
                <p className="text-center text-[0.72rem] text-ink-faint">
                  Check spam if it doesn&apos;t arrive in a minute.
                </p>
              )}
              {error && <p className="text-xs text-oxblood">{error}</p>}
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-oxblood py-3 text-sm font-semibold text-paper transition hover:bg-bronze-deep disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                {busy ? "Checking…" : "Sign in to the studio"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setDevCode(null);
                }}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 py-1 text-[0.72rem] font-medium text-ink-faint transition hover:text-ink"
              >
                <ArrowLeft className="size-3" /> Use a different email
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-[0.7rem] text-ink-faint">
          <ShieldCheck className="size-3.5 text-bronze" />
          Your stories stay yours — no ads, no data sales, ever.
        </p>
      </div>
    </main>
  );
}
