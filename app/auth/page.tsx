"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Loader2, Eye, EyeOff, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const { user, loading, signUp, signIn, resendConfirmation } = useAuth();
  const [mode, setMode] = React.useState<"up" | "in">("up");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: "error" | "ok"; text: string; showResend?: boolean } | null>(null);
  const [cool, setCool] = React.useState(0);

  React.useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cool]);

  async function resend() {
    if (cool > 0 || !email) return;
    setCool(60);
    const r = await resendConfirmation(email.trim());
    if (r.error) setMsg({ kind: "error", text: friendlyError(r.error), showResend: true });
    else setMsg({ kind: "ok", text: "Confirmation email sent — check your inbox and spam folder." });
  }

  React.useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  const strength = pass.length === 0 ? 0 : pass.length < 6 ? 1 : pass.length < 10 ? 2 : 3;

  async function go(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || !email || pass.length < 6) return;
    setBusy(true); setMsg(null);
    try {
      if (mode === "up") {
        const r = await signUp(email.trim(), pass);
        if (r.error) setMsg({ kind: "error", text: friendlyError(r.error) });
        else if (r.needsConfirm) setMsg({ kind: "ok", text: "Account created — check your inbox to confirm, then sign in." });
        else router.replace(next);
      } else {
        const r = await signIn(email.trim(), pass);
        if (r.error) setMsg({ kind: "error", text: friendlyError(r.error) });
        else router.replace(next);
      }
    } finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center" style={{ background: "#F4F6FB" }}>
        <div className="flex flex-col items-center gap-4" role="status" aria-label="Loading">
          <div className="loader-dial"><span /></div>
          <div className="font-data text-[11px] font-bold tracking-[.14em]" style={{ color: "#3F4A63" }}>VERIFYING SESSION…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]" style={{ background: "#F4F6FB" }}>
      {/* Brand panel */}
      <div className="hidden flex-col justify-between border-r p-10 lg:flex" style={{ background: "#fff", borderColor: "#E2E8F2" }}>
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="ResumeAI logo" width={40} height={40} className="rounded-[12px]" priority />
          <span className="font-display text-[19px] font-bold">ResumeAI</span>
        </Link>
        <div className="grid gap-5">
          <h1 className="font-display text-[42px] font-extrabold leading-[1.05] tracking-[-0.02em]">
            Your career data,<br />yours alone.
          </h1>
          <p className="max-w-[46ch] text-[15px] leading-7" style={{ color: "#3F4A63" }}>
            One account = one isolated workspace. Resumes, matches, roadmaps and quizzes are fenced per account — nobody else can read them.
          </p>
          <div className="grid gap-2.5">
            {["Private by default — only you can read your data", "Scores are guidance, never hiring verdicts", "Delete anytime — Reset data wipes your slice"].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-[13.5px]" style={{ color: "#3F4A63" }}><CheckCircle2 size={16} color="#0E9F6E" /> {t}</div>
            ))}
          </div>
        </div>
        <div className="font-data text-[11px] tracking-[.14em]" style={{ color: "#7A86A3" }}>SECURE SIGN-IN · PRIVATE BY DEFAULT</div>
      </div>

      {/* Form panel */}
      <div className="grid place-items-center p-6">
        <form onSubmit={go} className="card card-elev grid w-full max-w-[420px] gap-3.5 p-7">
          <div className="font-data text-[10px] font-bold tracking-[.14em]" style={{ color: "#3F4A63" }}>{mode === "up" ? "CREATE YOUR WORKSPACE" : "WELCOME BACK"}</div>
          <div className="font-display text-[24px] font-bold">{mode === "up" ? "Sign up" : "Sign in"}</div>

          <div className="grid grid-cols-2 gap-2 rounded-[12px] p-1" style={{ background: "#F0F3F9" }}>
            {(["up", "in"] as const).map((m) => (
              <button type="button" key={m} onClick={() => { setMode(m); setMsg(null); }}
                className="rounded-[10px] px-3 py-2 text-[13px] font-bold transition-all"
                style={mode === m ? { background: "#0B1220", color: "#fff" } : { color: "#3F4A63" }}>
                {m === "up" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          <label className="grid gap-1.5 text-[13px] font-bold">Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email"
              placeholder="you@college.edu" className="rounded-[10px] border px-3.5 py-2.5 font-normal" style={{ borderColor: "#E2E8F2" }} />
          </label>

          <label className="grid gap-1.5 text-[13px] font-bold">Password
            <span className="relative block">
              <input value={pass} onChange={(e) => setPass(e.target.value)} type={show ? "text" : "password"} required minLength={6} autoComplete={mode === "up" ? "new-password" : "current-password"}
                placeholder="6+ characters" className="w-full rounded-[10px] border px-3.5 py-2.5 pr-11 font-normal" style={{ borderColor: "#E2E8F2" }} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1" style={{ color: "#3F4A63" }}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          {mode === "up" && pass.length > 0 && (
            <div className="flex items-center gap-2" aria-live="polite">
              <div className="meter flex-1"><span style={{ width: `${(strength / 3) * 100}%`, background: strength === 1 ? "#DC2626" : strength === 2 ? "#B45309" : "#0E9F6E" }} /></div>
              <span className="font-data text-[10px] font-bold" style={{ color: "#3F4A63" }}>{["", "WEAK", "OK", "STRONG"][strength]}</span>
            </div>
          )}

          <button type="submit" disabled={busy || !email || pass.length < 6} className="btn-primary flex items-center justify-center gap-2 py-3 text-[14px]">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? (mode === "up" ? "Creating…" : "Signing in…") : (mode === "up" ? "Create account" : "Sign in")}
            {!busy && <ArrowRight size={15} />}
          </button>

          {msg && (
            <div className="rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium" role="alert"
              style={msg.kind === "error" ? { background: "#FDE8E8", color: "#B42323" } : { background: "#E6F7EE", color: "#0B7A55" }}>
              {msg.text}
            </div>
          )}

          <div className="flex items-center gap-2 text-[12px]" style={{ color: "#3F4A63" }}>
            <ShieldCheck size={14} color="#0E9F6E" />
            Private workspace per account · deletable anytime
          </div>
          <Link href="/" className="text-center text-[12.5px] font-semibold" style={{ color: "#2B5CFF" }}>← Back to home</Link>
        </form>
      </div>
    </div>
  );
}

function friendlyError(raw: string): string {
  const l = raw.toLowerCase();
  if (l.includes("invalid login") || l.includes("invalid credentials")) return "Wrong email or password — try again or create an account.";
  if (l.includes("already registered") || l.includes("already exists")) return "That email already has an account — hit Sign in instead.";
  if (l.includes("confirm")) return "Please confirm your email first (check inbox/spam), then sign in.";
  if (l.includes("password")) return "Password must be 6+ characters.";
  return raw;
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="grid min-h-screen place-items-center" style={{ background: "#F4F6FB" }}>
        <div className="loader-dial"><span /></div>
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
