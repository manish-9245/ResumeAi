"use client";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { AppShell, ScoreDial, Meter, Empty, Chip } from "@/components/shell";
import { readiness, recommendRoles } from "@/lib/analysis";
import { Reveal } from "@/components/reveal";
import { ArrowRight, UploadCloud, Briefcase, Map } from "lucide-react";

export default function Dashboard() {
  const { profile, health, fullHealth, jobs, avgMatch, verifiedCount, quiz } = useApp();
  const ready = readiness(profile, avgMatch, verifiedCount);
  const h = fullHealth as { score: number; issues: { section: string; severity: string; message: string; fix: string }[]; strengths: string[] } | null;

  if (!profile) {
    return (
      <AppShell requireAuth title="Career Readiness" sub="One honest overview: health, match, verified skills, and what to do next.">
        <Empty
          title="No resume yet — let's fix that in 60 seconds"
          body="Upload your PDF or paste a sample. Everything downstream (match, roadmap, quiz, assistant) reads from the same parsed profile."
          action={<Link href="/upload" className="btn-primary flex items-center gap-2 px-5 py-3 text-[14px]"><UploadCloud size={16} /> Upload resume</Link>}
        />
      </AppShell>
    );
  }

  const recs = recommendRoles(profile);
  const nextSteps = [
    h && h.score < 70 ? `Raise health (${h.score}%) — fix: ${h.issues[0]?.fix ?? "add metrics"}` : null,
    jobs.length === 0 ? "Paste your first JD on Jobs & Match" : avgMatch !== null && avgMatch < 70 ? `Top gap: ${jobs[0]?.missing[0] ?? "a deploy skill"} — see Roadmap` : null,
    verifiedCount === 0 ? "Take the 6-question verification quiz" : null,
  ].filter(Boolean) as string[];

  return (
    <AppShell requireAuth title={`Namaste, ${profile.name.split(" ")[0]} — here's your readiness`} sub="Decision-support, not a verdict. Every number below links to its why + fix.">
      <Reveal className="grid gap-3 lg:grid-cols-[300px_1fr_1fr]">
        <div className="card card-elev flex flex-col items-center gap-3 p-4 rise sm:p-6">
          <ScoreDial value={ready} label="READINESS" />
          <div className="font-data text-[11px]" style={{ color: "#3F4A63" }}>SIMULATED · SUPPORT ONLY</div>
        </div>
        <div className="card grid content-center gap-4 p-4 rise rise-1 sm:p-6">
          <div>
            <div className="flex items-center justify-between text-[13px] font-semibold"><span>Resume health</span><span className="font-data">{h?.score ?? (health?.score ?? 0)}%</span></div>
            <div className="mt-2"><Meter value={h?.score ?? 0} color="#0E9F6E" /></div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[13px] font-semibold"><span>Avg job match {avgMatch === null ? "(no JD yet)" : ""}</span><span className="font-data">{avgMatch ?? "—"}{avgMatch !== null ? "%" : ""}</span></div>
            <div className="mt-2"><Meter value={avgMatch ?? 0} /></div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[13px] font-semibold"><span>Verified skills</span><span className="font-data">{verifiedCount}/{profile.skills.length || quiz.length || 6}</span></div>
            <div className="mt-2"><Meter value={profile.skills.length ? Math.min(100, (verifiedCount / Math.max(profile.skills.length, 1)) * 100) : 0} color="#0E9F6E" /></div>
          </div>
        </div>
        <div className="card card-elev grid content-center gap-2.5 border p-4 rise rise-2 sm:p-6" style={{ background: "#EAF0FF", borderColor: "#C9D6FF" }}>
          <div className="font-data text-[10px] font-bold tracking-[.14em]" style={{ color: "#1E40D8" }}>RECOMMENDED NEXT</div>
          {nextSteps.length === 0 && <div className="font-display text-[16px] font-bold">Apply — you read as ready. Keep verifying.</div>}
          {nextSteps.map((s, i) => <div key={i} className="flex gap-2 text-[13.5px] leading-6"><span className="font-data font-bold" style={{ color: "#1E40D8" }}>{i + 1}.</span> {s}</div>)}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link href="/jobs" className="btn-primary flex min-h-[44px] items-center justify-center gap-1.5 px-4 py-2.5 text-[13px]">Match a JD <ArrowRight size={14} /></Link>
            <Link href="/roadmap" className="flex min-h-[44px] items-center justify-center rounded-[12px] border px-4 py-2.5 text-[13px] font-semibold" style={{ borderColor: "#2B5CFF", color: "#1E40D8", background: "#fff" }}>Roadmap</Link>
          </div>
        </div>
      </Reveal>

      <Reveal delay={120} className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="card min-w-0 p-4 sm:p-6">
          <div className="font-display text-[16px] font-bold">Why this score</div>
          <div className="mt-3 grid gap-2.5">
            {(h?.strengths ?? []).map((s) => <div key={s} className="flex gap-2 text-[13.5px]"><span style={{ color: "#0E9F6E" }}>●</span> {s}</div>)}
            {(h?.issues ?? []).slice(0, 3).map((i) => (
              <div key={i.section + i.message} className="min-w-0 rounded-[10px] border px-3.5 py-2.5" style={{ borderColor: "#E2E8F2" }}>
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">{i.section} <Chip tone={i.severity === "good" ? "have" : i.severity === "warn" ? "partial" : "missing"}>{i.severity}</Chip></div>
                <div className="mt-1 text-[13px] break-words" style={{ color: "#3F4A63" }}>{i.message} → <b style={{ color: "#0E1525" }}>{i.fix}</b></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card min-w-0 p-4 sm:p-6">
          <div className="font-display text-[16px] font-bold">Roles that fit now</div>
          <div className="mt-3 grid gap-2.5">
            {recs.map((r) => (
              <div key={r.role} className="min-w-0 rounded-[10px] border px-3.5 py-2.5" style={{ borderColor: "#E2E8F2" }}>
                <div className="text-[13.5px] font-bold">{r.role}</div>
                <div className="text-[13px] break-words" style={{ color: "#3F4A63" }}>{r.why} <b style={{ color: "#1E40D8" }}>{r.lift}</b></div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-semibold">
            <Link href="/upload" className="flex min-h-[40px] items-center gap-1.5" style={{ color: "#2B5CFF" }}><UploadCloud size={14} /> Re-analyze</Link>
            <Link href="/quiz" className="flex min-h-[40px] items-center gap-1.5" style={{ color: "#2B5CFF" }}><Briefcase size={14} /> Verify skills</Link>
            <Link href="/assistant" className="flex min-h-[40px] items-center gap-1.5" style={{ color: "#2B5CFF" }}><Map size={14} /> Ask assistant</Link>
          </div>
        </div>
      </Reveal>
    </AppShell>
  );
}
