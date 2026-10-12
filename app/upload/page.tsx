"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { AppShell, ScoreDial, Meter, Chip } from "@/components/shell";
import { AnalyzingSteps, DossierSkeleton } from "@/components/loading";
import { extractTextFromPDF, SAMPLE_RESUME } from "@/lib/pdf";
import { FileUp, ClipboardPaste, Sparkles, Loader2 } from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  const { setResume } = useApp();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [stage, setStage] = React.useState(0);
  const [err, setErr] = React.useState("");
  const [result, setResult] = React.useState<{ profile: { name: string; skills: string[] }; health: { score: number; issues: { section: string; severity: string; message: string; fix: string }[]; strengths: string[] }; aiNote?: string; cached?: boolean; analysisId?: string | null } | null>(null);

  React.useEffect(() => {
    if (!busy) return;
    setStage(0);
    const t1 = setTimeout(() => setStage(1), 900);
    const t2 = setTimeout(() => setStage(2), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [busy]);

  async function analyze(t: string) {
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeText: t }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Analysis failed");
      setResult(j);
      setResume(t, j.profile, j.health); // store syncs to cloud (same device + others)
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr("");
    if (!f.name.toLowerCase().endsWith(".pdf")) { setErr("Only PDF for now — or paste text below."); return; }
    setBusy(true);
    try {
      const t = await extractTextFromPDF(f);
      if (t.trim().length < 50) throw new Error("PDF text unreadable — paste your resume text below instead.");
      setText(t);
      await analyze(t);
    } catch (e) { setErr(e instanceof Error ? e.message : "PDF parse failed"); setBusy(false); }
  }

  return (
    <AppShell requireAuth title="Upload & health check" sub="PDF is parsed in your browser (free) → structured by AI. Nothing is invented; weak sections get exact fixes.">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card grid min-w-0 gap-3 p-4 sm:p-6">
          <label className="grid cursor-pointer place-items-center gap-2 rounded-[12px] border border-dashed px-6 py-8 text-center" style={{ borderColor: "#2B5CFF", background: "#F2F5FF" }}>
            <FileUp size={22} color="#2B5CFF" />
            <span className="font-display text-[15px] font-bold">Drop your resume PDF here</span>
            <span className="text-[12.5px]" style={{ color: "#3F4A63" }}>or click to browse · parsed locally, never sold</span>
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: "#3F4A63" }}><span className="h-px flex-1" style={{ background: "#E2E8F2" }} /> OR PASTE TEXT <span className="h-px flex-1" style={{ background: "#E2E8F2" }} /></div>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} rows={10}
            placeholder="Paste resume text here… (name, education, skills, projects…)"
            className="w-full rounded-[12px] border p-3.5 font-mono text-[12.5px] leading-5" style={{ borderColor: "#E2E8F2" }}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button disabled={busy || text.trim().length < 50} onClick={() => analyze(text)} className="btn-primary flex min-h-[44px] items-center justify-center gap-2 px-5 py-3 text-[14px]">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? "Analyzing…" : "Analyze resume"}
            </button>
            <button onClick={() => { setText(SAMPLE_RESUME); }} className="flex min-h-[44px] items-center justify-center rounded-[12px] border px-4 py-3 text-[13px] font-semibold" style={{ borderColor: "#E2E8F2", background: "#fff" }}>
              <span className="flex items-center gap-1.5"><ClipboardPaste size={15} /> Try sample</span>
            </button>
          </div>
          {err && <div className="rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium" style={{ background: "#FDE8E8", color: "#B42323" }}>{err} — fix: use a text-based PDF or paste text.</div>}
        </div>

        <div className="card card-elev min-w-0 p-4 sm:p-6">
          {busy && (
            <div className="grid gap-5" role="status" aria-live="polite" aria-label="Analyzing resume">
              <AnalyzingSteps stage={stage} />
              <DossierSkeleton />
            </div>
          )}
          {!busy && !result && <div className="grid h-full place-items-center py-14 text-center text-[13.5px]" style={{ color: "#3F4A63" }}>Your health dossier appears here.<br />Score dial + weak sections + strengths.</div>}
          {result && (
            <div className="rise grid gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="flex justify-center sm:shrink-0"><ScoreDial value={result.health.score} label="HEALTH" size={118} /></div>
                <div className="min-w-0">
                  <div className="font-display break-words text-[18px] font-bold">{result.profile.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">{result.profile.skills.slice(0, 8).map((s) => <Chip key={s} tone="info">{s}</Chip>)}</div>
                  {result.aiNote && <div className="mt-2 text-[12.5px] italic" style={{ color: "#3F4A63" }}>{result.aiNote}</div>}
                  {result.cached && <div className="font-data mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "#E6F7EE", color: "#0B7A55" }}>SAVED RESULT · ALREADY CHECKED</div>}
                </div>
              </div>
              <div className="grid gap-2">
                {result.health.issues.map((i) => (
                  <div key={i.section} className="rounded-[10px] border px-3.5 py-2.5" style={{ borderColor: "#E2E8F2" }}>
                    <div className="flex items-center gap-2 text-[13px] font-bold">{i.section} <Chip tone={i.severity === "good" ? "have" : i.severity === "warn" ? "partial" : "missing"}>{i.severity}</Chip></div>
                    <div className="text-[13px]" style={{ color: "#3F4A63" }}>{i.fix}</div>
                    <div className="mt-1.5"><Meter value={i.severity === "critical" ? 25 : 55} color={i.severity === "critical" ? "#DC2626" : "#B45309"} /></div>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push("/jobs")} className="btn-primary min-h-[44px] px-5 py-3 text-[14px]">Continue → match a job</button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
