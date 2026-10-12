"use client";
import React from "react";

/** Base shimmer block — the dossier-paper loading atom. */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={`shimmer rounded-[10px] ${className}`} style={style} />;
}

/** Full-page auth/session gate loader. */
export function FullPageLoader({ status = "Verifying session…" }: { status?: string }) {
  return (
    <div className="grid min-h-[52vh] place-items-center" role="status" aria-live="polite" aria-label={status}>
      <div className="flex flex-col items-center gap-4">
        <div className="loader-dial" aria-hidden>
          <span />
        </div>
        <div className="font-display text-[16px] font-bold">ResumeAI</div>
        <div className="font-data text-[11px] font-bold tracking-[.14em]" style={{ color: "#3F4A63" }}>{status.toUpperCase()}</div>
      </div>
    </div>
  );
}

/** Staged analyzing progress: parsing → structuring → scoring. */
const ANALYZE_STEPS = ["Parsing PDF text", "Structuring profile", "Scoring health"];
export function AnalyzingSteps({ stage }: { stage: number }) {
  return (
    <div className="grid gap-2.5" role="status" aria-live="polite" aria-label="Analyzing resume">
      {ANALYZE_STEPS.map((s, i) => {
        const done = i < stage;
        const active = i === stage;
        return (
          <div key={s} className="flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5" style={{ borderColor: "#E2E8F2", background: active ? "#F2F5FF" : "#fff" }}>
            <span className={`step-dot ${done ? "done" : active ? "active" : ""}`} aria-hidden>
              {done ? "✓" : active ? <span className="step-spin" /> : ""}
            </span>
            <span className="text-[13px] font-semibold">{s}{active ? "…" : done ? "" : ""}</span>
            {active && <span className="font-data ml-auto text-[10px] font-bold" style={{ color: "#1E40D8" }}>WORKING</span>}
            {done && <span className="font-data ml-auto text-[10px] font-bold" style={{ color: "#0B7A55" }}>DONE</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Dossier-shaped skeleton for the upload result panel. */
export function DossierSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex justify-center sm:shrink-0"><Skeleton className="rounded-full!" style={{ width: 118, height: 118, borderRadius: 999 }} /></div>
        <div className="grid min-w-0 flex-1 gap-2">
          <Skeleton style={{ height: 20, width: "55%" }} />
          <div className="flex gap-1.5"><Skeleton style={{ height: 22, width: 64 }} /><Skeleton style={{ height: 22, width: 58 }} /><Skeleton style={{ height: 22, width: 70 }} /></div>
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[10px] border p-3" style={{ borderColor: "#E2E8F2" }}>
          <Skeleton style={{ height: 14, width: "40%", marginBottom: 8 }} />
          <Skeleton style={{ height: 12, width: "85%" }} />
          <div className="meter mt-2"><span className="shimmer-bar" /></div>
        </div>
      ))}
    </div>
  );
}

/** Three match-card skeletons for Jobs. */
export function MatchCardsSkeleton() {
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card p-5" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="flex items-start justify-between">
            <div className="grid flex-1 gap-2"><Skeleton style={{ height: 18, width: "70%" }} /><Skeleton style={{ height: 12, width: "45%" }} /></div>
            <Skeleton style={{ width: 72, height: 72, borderRadius: 999 }} />
          </div>
          <Skeleton className="mt-3" style={{ height: 12, width: "90%" }} />
          <div className="mt-3 flex gap-1.5"><Skeleton style={{ height: 22, width: 62 }} /><Skeleton style={{ height: 22, width: 70 }} /><Skeleton style={{ height: 22, width: 58 }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Vertical rail skeleton for Roadmap. */
export function RailSkeleton() {
  return (
    <div className="grid gap-0" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[64px_1fr] sm:gap-3">
          <div className="flex flex-row items-center gap-2 pt-3 sm:flex-col sm:pt-5">
            <Skeleton style={{ width: 40, height: 40, borderRadius: 999 }} />
            {i < 3 && <span className="hidden w-0.5 flex-1 sm:block sm:min-h-[70px]" style={{ background: "#E2E8F2" }} />}
          </div>
          <div className="card mb-3 min-w-0 p-4 sm:p-5">
            <Skeleton style={{ height: 12, width: "30%", marginBottom: 10 }} />
            <Skeleton style={{ height: 20, width: "60%", marginBottom: 10 }} />
            <Skeleton style={{ height: 12, width: "90%", marginBottom: 6 }} />
            <Skeleton style={{ height: 12, width: "75%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Quiz question skeletons. */
export function QuizSkeleton() {
  return (
    <div className="mt-3 grid gap-2.5" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="card p-5">
          <Skeleton style={{ height: 14, width: "35%", marginBottom: 10 }} />
          <Skeleton style={{ height: 18, width: "80%", marginBottom: 12 }} />
          <Skeleton style={{ height: 40, width: "100%", marginBottom: 6 }} />
          <Skeleton style={{ height: 40, width: "100%" }} />
        </div>
      ))}
    </div>
  );
}

/** Assistant "thinking with your profile" bubble. */
export function ChatThinking() {
  return (
    <div className="max-w-[220px] justify-self-start rounded-[12px] border px-4 py-3" style={{ borderColor: "#E2E8F2", background: "#fff" }} role="status" aria-label="Assistant is thinking">
      <div className="typing-dots" aria-hidden><span /><span /><span /></div>
    </div>
  );
}
