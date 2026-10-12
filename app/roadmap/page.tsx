"use client";
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { AppShell, Empty, Chip } from "@/components/shell";
import { RailSkeleton, Skeleton } from "@/components/loading";
import type { RoadmapStep } from "@/lib/types";
import { Loader2, Map as MapIcon, ArrowRight, History } from "lucide-react";

function RoadmapInner() {
  const params = useSearchParams();
  const { profile, jobs } = useApp();
  const [steps, setSteps] = React.useState<RoadmapStep[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [roadmapId, setRoadmapId] = React.useState<string | null>(null);
  const [fromCache, setFromCache] = React.useState(false);
  const [jobSel, setJobSel] = React.useState<string>("");
  const [history, setHistory] = React.useState<{ id: string; title: string; created_at: string; job_match_id: string | null }[]>([]);

  const withDb = jobs.filter((j) => j.dbId);

  // Preselect job from ?job=<matchId> (e.g. "Roadmap for this job" links).
  React.useEffect(() => {
    const q = params.get("job");
    if (q && withDb.some((j) => j.dbId === q)) setJobSel(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  React.useEffect(() => {
    fetch("/api/history?kind=roadmaps").then((r) => r.json()).then((j) => setHistory(j.items ?? [])).catch(() => {});
  }, []);

  async function build(forJob?: string) {
    if (!profile) return;
    setBusy(true); setFromCache(false);
    try {
      const target = jobs.find((j) => j.dbId === (forJob ?? jobSel)) ?? jobs[0];
      const gaps = target?.gaps ?? [{ skill: "docker", status: "missing" }, { skill: "typescript", status: "partial" }];
      const jobMatchId = target?.dbId ?? null;
      const r = await fetch("/api/ai?kind=roadmap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, gaps, jobMatchId }),
      });
      const j = await r.json();
      setSteps(j.steps ?? []);
      setRoadmapId(j.roadmapId ?? null);
      setFromCache(Boolean(j.cached));
    } finally { setBusy(false); }
  }

  React.useEffect(() => { if (profile && steps.length === 0 && !busy) build(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (!profile) return <AppShell requireAuth title="Learning roadmap" sub="What-first ordering from your gaps."><Empty title="Upload first" body="Roadmap is built from your missing skills — upload a resume to generate it." action={<a href="/upload" className="btn-primary px-5 py-3 text-[14px]">Upload</a>} /></AppShell>;

  const selJob = jobs.find((j) => j.dbId === jobSel);

  return (
    <AppShell requireAuth title="Learning roadmap" sub="Ordered by hiring leverage, not alphabet. Each step ends with a provable artifact — a link you can put on your resume.">
      {withDb.length > 0 && (
        <div className="card mb-3 flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-[13px] font-bold">Roadmap for:</span>
          <select value={jobSel} onChange={(e) => setJobSel(e.target.value)} aria-label="Roadmap job"
            className="min-w-0 w-full rounded-[10px] border bg-white px-3 py-2.5 text-[13px] font-medium sm:flex-1 sm:max-w-[320px]" style={{ borderColor: "#E2E8F2" }}>
            <option value="">General (top gaps)</option>
            {withDb.map((j) => <option key={j.dbId} value={j.dbId!}>{j.title} @ {j.company} ({j.matchScore}%)</option>)}
          </select>
          <button onClick={() => build()} disabled={busy} className="btn-primary flex min-h-[44px] items-center justify-center gap-1.5 px-4 py-2.5 text-[13px]">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <MapIcon size={14} />} Rebuild
          </button>
        </div>
      )}

      {busy && <RailSkeleton />}
      {!busy && !steps.length && (
        <button onClick={() => build()} disabled={busy} className="btn-primary flex items-center gap-2 px-5 py-3 text-[14px]"><MapIcon size={16} /> Build my roadmap</button>
      )}
      {!busy && roadmapId && (
        <div className="mb-3 flex flex-col gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium sm:flex-row sm:flex-wrap sm:items-center" style={{ background: fromCache ? "#E6F7EE" : "#F2F5FF", color: fromCache ? "#0B7A55" : "#1E40D8" }}>
          {fromCache ? "Loaded your saved roadmap." : `Saved${selJob ? ` for ${selJob.title}` : ""}.`}
          <a href={`/roadmap/${roadmapId}`} className="flex min-h-[40px] items-center gap-1 font-bold sm:ml-auto">Open /roadmap/{roadmapId.slice(0, 8)} <ArrowRight size={13} /></a>
        </div>
      )}
      {steps.length > 0 && !busy && (
        <div className="grid gap-0">
          {steps.map((s, i) => (
            <div key={s.order} className="rise grid gap-2 sm:grid-cols-[64px_1fr] sm:gap-3" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="flex flex-row items-center gap-2 pt-3 sm:flex-col sm:pt-5">
                <span className="font-data grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold text-white" style={{ background: i === steps.length - 1 ? "#0E9F6E" : "#2B5CFF" }}>{s.order}</span>
                {i < steps.length - 1 && <span className="hidden w-0.5 flex-1 sm:block sm:min-h-[90px]" style={{ background: "#E2E8F2" }} />}
              </div>
              <div className="card mb-3 min-w-0 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-data text-[11px] font-bold" style={{ color: "#3F4A63" }}>{s.weeks.toUpperCase()}</span>
                  {s.skills.map((k) => <Chip key={k} tone="info">{k}</Chip>)}
                </div>
                <div className="font-display mt-1 text-[18px] font-bold">{s.title}</div>
                <ul className="mt-2 grid gap-1.5">{s.actions.map((a) => <li key={a} className="flex gap-2 text-[13.5px]" style={{ color: "#3F4A63" }}><span style={{ color: "#2B5CFF" }}>→</span> {a}</li>)}</ul>
                <div className="mt-3 rounded-[10px] px-3.5 py-2.5 text-[13px]" style={{ background: "#F2F5FF" }}><b>Ship:</b> {s.project}<br /><b>Proves:</b> {s.outcome}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && !busy && (
        <div className="card mt-3 min-w-0 p-4 sm:p-5">
          <div className="flex items-center gap-2 font-display text-[15px] font-bold"><History size={15} /> Saved roadmaps</div>
          <div className="mt-2.5 grid gap-2">
            {history.map((h) => (
              <a key={h.id} href={`/roadmap/${h.id}`} className="flex min-w-0 items-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] hover:border-[#2B5CFF]" style={{ borderColor: "#E2E8F2" }}>
                <b className="min-w-0 flex-1 truncate">{h.title}</b>
                <span className="shrink-0" style={{ color: "#3F4A63" }}>{new Date(h.created_at).toLocaleDateString()}</span>
                <ArrowRight size={13} color="#2B5CFF" className="shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
      {busy && history.length === 0 && <Skeleton style={{ height: 120 }} />}
    </AppShell>
  );
}

export default function RoadmapPage() {
  return (
    <Suspense fallback={<AppShell requireAuth title="Learning roadmap"><RailSkeleton /></AppShell>}>
      <RoadmapInner />
    </Suspense>
  );
}
