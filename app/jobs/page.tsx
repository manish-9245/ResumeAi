"use client";
import React from "react";
import { useApp } from "@/lib/store";
import { AppShell, ScoreDial, Chip, Empty, Meter } from "@/components/shell";
import { MatchCardsSkeleton, Skeleton } from "@/components/loading";
import { Reveal } from "@/components/reveal";
import { recommendRoles } from "@/lib/analysis";
import type { JobMatch } from "@/lib/types";
import type { LiveJob } from "@/lib/live-jobs";
import { Plus, Loader2, FlaskConical, ArrowRight, Wand2, Globe, ExternalLink, Crosshair, ChevronLeft, ChevronRight } from "lucide-react";

const SAMPLE_JDS = [
  { title: "Frontend Intern", company: "Zylo", jd: "Hiring Frontend Intern: JavaScript, TypeScript, React, HTML/CSS, Git. Bonus: testing with Jest, responsive design." },
  { title: "Backend Intern", company: "DataKraft", jd: "Backend Intern: Python, SQL, Git, Docker. Bonus: AWS, system design, testing with pytest, FastAPI." },
  { title: "ML Intern", company: "VisionLabs", jd: "ML Intern: Python, machine learning, data analysis with pandas, SQL, Git. Bonus: Docker, communication." },
];

export default function JobsPage() {
  const { profile, jobs, setJobs } = useApp();
  const [forms, setForms] = React.useState([{ title: "", company: "", jd: "" }]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [strategy, setStrategy] = React.useState("");
  const [whatIf, setWhatIf] = React.useState<string[]>([]);
  const [improving, setImproving] = React.useState(false);
  const [live, setLive] = React.useState<LiveJob[]>([]);
  const [liveBusy, setLiveBusy] = React.useState(false);
  const [liveQueried, setLiveQueried] = React.useState<string[]>([]);
  const [liveNote, setLiveNote] = React.useState("");
  const [matchingId, setMatchingId] = React.useState<string | null>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const liveTopRef = React.useRef<HTMLDivElement>(null);
  const LIVE_PAGE_SIZE = 4;
  const [livePage, setLivePage] = React.useState(1);
  const livePages = Math.max(1, Math.ceil(live.length / LIVE_PAGE_SIZE));
  const liveShown = live.slice((livePage - 1) * LIVE_PAGE_SIZE, livePage * LIVE_PAGE_SIZE);

  React.useEffect(() => { setLivePage(1); }, [live.length]);

  function gotoLivePage(p: number) {
    setLivePage(Math.min(livePages, Math.max(1, p)));
    liveTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const [improve, setImprove] = React.useState<{ suggestions: { section: string; before: string; after: string; reason: string }[]; aiRewrite?: string } | null>(null);
  const [history, setHistory] = React.useState<{ id: string; title: string; company: string; created_at: string; result: JobMatch }[]>([]);
  const [cachedNote, setCachedNote] = React.useState(false);

  function withDbIds(matches: JobMatch[], dbIds: (string | null)[]): JobMatch[] {
    return matches.map((m, i) => ({ ...m, dbId: dbIds?.[i] ?? m.dbId ?? null }));
  }

  React.useEffect(() => {
    fetch("/api/history?kind=matches").then((r) => r.json()).then((j) => setHistory(j.items ?? [])).catch(() => {});
  }, []);

  async function runMatch(list = forms) {
    if (!profile) { setErr("Upload a resume first."); return; }
    const valid = list.filter((f) => f.jd.trim().length > 20);
    if (!valid.length) { setErr("Paste at least one JD (20+ chars)."); return; }
    setBusy(true); setErr(""); setCachedNote(false);
    try {
      const r = await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, jobs: valid.slice(0, 3) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setJobs(withDbIds(j.matches, j.dbIds));
      setStrategy(j.strategy ?? "");
      setCachedNote(Boolean(j.cached));
    } catch (e) { setErr(e instanceof Error ? e.message : "Match failed"); }
    finally { setBusy(false); }
  }

    // Live listings searched by the profile's own skills.
  const skillKey = profile?.skills.join("|") ?? "";
  React.useEffect(() => {
    if (!profile || !profile.skills.length) return;
    let cancelled = false;
    setLiveBusy(true); setLiveNote("");
    fetch("/api/live-jobs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills: profile.skills }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setLive(j.jobs ?? []); setLiveQueried(j.queried ?? []); setLiveNote(j.note ?? "");
      })
      .catch(() => { if (!cancelled) setLiveNote("Live sources unreachable — paste a JD below instead."); })
      .finally(() => { if (!cancelled) setLiveBusy(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillKey]);

  async function matchLive(job: LiveJob) {
    if (!profile || matchingId) return;
    setMatchingId(job.id); setErr("");
    try {
      const r = await fetch("/api/match", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, jobs: [{ title: job.title, company: job.company, jd: `${job.title} at ${job.company}. ${job.tags.join(", ")}. ${job.description}`.slice(0, 4000) }] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setJobs([...jobs.filter((m) => m.title !== job.title || m.company !== job.company), ...withDbIds(j.matches ?? [], j.dbIds)].slice(-6));
      setStrategy("");
      setCachedNote(Boolean(j.cached));
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) { setErr(e instanceof Error ? e.message : "Match failed"); }
    finally { setMatchingId(null); }
  }

  async function loadImprove() {
    if (!profile || improving) return;
    setImproving(true);
    try {
      const r = await fetch("/api/ai?kind=improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile }) });
      setImprove(await r.json());
    } finally { setImproving(false); }
  }

  if (!profile) {
    return <AppShell requireAuth title="Jobs & match" sub="Compare up to 3 JDs side-by-side against the same profile."><Empty title="Need your profile first" body="Match scores are computed from your parsed resume — upload it, then paste any JD." action={<a href="/upload" className="btn-primary px-5 py-3 text-[14px]">Upload resume</a>} /></AppShell>;
  }

  const best = [...jobs].sort((a, b) => b.matchScore - a.matchScore)[0];
  const recs = recommendRoles(profile);

  function lifted(m: JobMatch): number {
    const extra = whatIf.filter((s) => m.missing.includes(s) || m.partial.includes(s)).length;
    return Math.min(97, m.matchScore + extra * 7);
  }

  return (
    <AppShell requireAuth title="Jobs & match" sub="Decision-support scores. Same profile, up to 3 JDs — strengths, gaps, and what learning each gap unlocks.">
      <div className="card grid min-w-0 gap-3 p-4 sm:p-5">
        {forms.map((f, i) => (
          <div key={i} className="grid min-w-0 gap-2 rounded-[12px] border p-3 sm:p-3.5" style={{ borderColor: "#E2E8F2" }}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={f.title} onChange={(e) => setForms(forms.map((x, k) => k === i ? { ...x, title: e.target.value } : x))} placeholder="Role title (e.g. Frontend Intern)" className="min-w-0 rounded-[10px] border px-3 py-2.5 text-[13px]" style={{ borderColor: "#E2E8F2" }} />
              <input value={f.company} onChange={(e) => setForms(forms.map((x, k) => k === i ? { ...x, company: e.target.value } : x))} placeholder="Company" className="min-w-0 rounded-[10px] border px-3 py-2.5 text-[13px]" style={{ borderColor: "#E2E8F2" }} />
            </div>
            <textarea value={f.jd} onChange={(e) => setForms(forms.map((x, k) => k === i ? { ...x, jd: e.target.value } : x))} rows={3} placeholder="Paste job description…" className="min-w-0 rounded-[10px] border px-3 py-2.5 font-mono text-[12px]" style={{ borderColor: "#E2E8F2" }} />
          </div>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {forms.length < 3 && <button onClick={() => setForms([...forms, { title: "", company: "", jd: "" }])} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[12px] border px-4 py-2.5 text-[13px] font-semibold" style={{ borderColor: "#E2E8F2", background: "#fff" }}><Plus size={15} /> Add JD ({forms.length}/3)</button>}
          <button onClick={() => runMatch()} disabled={busy} className="btn-primary flex min-h-[44px] items-center justify-center gap-2 px-5 py-2.5 text-[13px]">{busy ? <Loader2 size={15} className="animate-spin" /> : null} {busy ? "Matching…" : "Compare jobs"}</button>
          <button onClick={() => { setForms(SAMPLE_JDS); setTimeout(() => runMatch(SAMPLE_JDS), 50); }} className="min-h-[44px] rounded-[12px] border px-4 py-2.5 text-[13px] font-semibold" style={{ borderColor: "#E2E8F2", background: "#fff" }}>Try 3 samples</button>
        </div>
        {err && <div className="rounded-[10px] px-3 py-2 text-[13px] font-medium" style={{ background: "#FDE8E8", color: "#B42323" }}>{err}</div>}
        {strategy && <div className="rounded-[10px] px-3.5 py-2.5 text-[13px]" style={{ background: "#E4EBFF", color: "#1E40D8" }}>{strategy}</div>}
      </div>

      <div className="card mt-3 min-w-0 p-4 sm:p-5">
        <div ref={liveTopRef} className="flex min-w-0 scroll-mt-24 flex-wrap items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: "#E4EBFF", color: "#1E40D8" }}><Globe size={18} /></span>
          <div>
            <div className="font-display text-[16px] font-bold">Live jobs for your skills</div>
            <div className="text-[12.5px]" style={{ color: "#3F4A63" }}>
              {liveQueried.length > 0 ? <>Matched to <span className="font-data font-bold">{liveQueried.join(" · ")}</span> · </> : "Searching listings matched to your skills · "}
              <span className="font-data">UPDATED FRESH ON EVERY VISIT</span>
            </div>
          </div>
          {liveBusy && <span className="font-data ml-auto text-[11px] font-bold" style={{ color: "#1E40D8" }}>SEARCHING…</span>}
        </div>

        {liveBusy && (
          <div className="mt-4 grid gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[10px] border p-3.5" style={{ borderColor: "#E2E8F2" }}>
                <Skeleton style={{ height: 16, width: "55%", marginBottom: 8 }} />
                <Skeleton style={{ height: 12, width: "80%" }} />
              </div>
            ))}
          </div>
        )}

        {!liveBusy && liveNote && live.length === 0 && (
          <div className="mt-3 text-[13px]" style={{ color: "#3F4A63" }}>{liveNote}</div>
        )}

        {!liveBusy && live.length > 0 && (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {liveShown.map((j) => (
              <div key={j.id} className="rise grid gap-2 rounded-[12px] border p-4" style={{ borderColor: "#E2E8F2" }}>
                <div>
                  <div className="text-[14px] font-bold leading-5">{j.title}</div>
                  <div className="mt-0.5 text-[12.5px]" style={{ color: "#3F4A63" }}>{j.company} · {j.location} · {j.type}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {j.tags.slice(0, 3).map((t) => <Chip key={t} tone="info">{t}</Chip>)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => matchLive(j)}
                    disabled={matchingId !== null}
                    className="btn-primary flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[12.5px] disabled:opacity-60"
                  >
                    {matchingId === j.id ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
                    {matchingId === j.id ? "Matching…" : "Match me"}
                  </button>
                  <a href={j.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-[12px] border px-3 py-2 text-[12.5px] font-bold" style={{ borderColor: "#E2E8F2" }}>
                    Apply <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
        {livePages > 1 && !liveBusy && (
          <nav className="mt-4 flex flex-wrap items-center justify-center gap-1.5" aria-label="Live jobs pages">
            <button
              onClick={() => gotoLivePage(livePage - 1)} disabled={livePage === 1}
              aria-label="Previous page"
              className="grid h-9 w-9 place-items-center rounded-[10px] border disabled:opacity-40" style={{ borderColor: "#E2E8F2", background: "#fff" }}
            ><ChevronLeft size={16} /></button>
            {Array.from({ length: livePages }, (_, i) => i + 1).map((p) => (
              <button
                key={p} onClick={() => gotoLivePage(p)}
                aria-label={`Page ${p}`} aria-current={p === livePage ? "page" : undefined}
                className="font-data h-9 min-w-9 rounded-[10px] px-2 text-[12.5px] font-bold"
                style={p === livePage ? { background: "#2B5CFF", color: "#fff" } : { background: "#fff", border: "1px solid #E2E8F2", color: "#0E1525" }}
              >{p}</button>
            ))}
            <button
              onClick={() => gotoLivePage(livePage + 1)} disabled={livePage === livePages}
              aria-label="Next page"
              className="grid h-9 w-9 place-items-center rounded-[10px] border disabled:opacity-40" style={{ borderColor: "#E2E8F2", background: "#fff" }}
            ><ChevronRight size={16} /></button>
            <span className="font-data ml-1 text-[11px] font-bold" style={{ color: "#3F4A63" }}>
              PAGE {livePage}/{livePages} · {live.length} JOBS
            </span>
          </nav>
        )}
      </div>

      <div ref={resultsRef} className="scroll-mt-24" />
      {busy && <MatchCardsSkeleton />}

      {jobs.length > 0 && !busy && (
        <>
          <Reveal className="mt-3 grid gap-3 lg:grid-cols-3">
            {jobs.map((m) => (
              <div key={m.id} className="card card-elev rise grid min-w-0 gap-3 p-4 sm:p-5" style={best?.id === m.id ? { outline: "2px solid #2B5CFF" } : undefined}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1"><div className="font-display break-words text-[16px] font-bold">{m.title || "Target role"}</div><div className="break-words text-[12.5px]" style={{ color: "#3F4A63" }}>{m.company || "Company"}{best?.id === m.id ? " · BEST FIT" : ""}</div></div>
                  <div className="shrink-0"><ScoreDial value={whatIf.length ? lifted(m) : m.matchScore} size={96} /></div>
                </div>
                {m.dbId && (
                  <a href={`/jobs/${m.dbId}`} className="font-data text-[11px] font-bold tracking-wide" style={{ color: "#1E40D8" }}>OPEN SAVED RESULT ↗ /jobs/{m.dbId.slice(0, 8)}</a>
                )}
                <div className="text-[13px] italic" style={{ color: "#3F4A63" }}>{m.verdict}</div>
                <div className="grid gap-1.5">
                  <div className="flex flex-wrap gap-1.5">{m.matched.map((s) => <Chip key={s} tone="have">{s}</Chip>)}{m.partial.map((s) => <Chip key={s} tone="partial">~{s}</Chip>)}{m.missing.map((s) => <Chip key={s} tone="missing">+{s}</Chip>)}</div>
                </div>
                <div className="grid gap-1.5">
                  {m.gaps.filter((g) => g.status !== "have").slice(0, 3).map((g) => (
                    <label key={g.skill} className="flex cursor-pointer items-start gap-2 rounded-[10px] border px-2.5 py-2 text-[12.5px]" style={{ borderColor: "#E2E8F2" }}>
                      <input type="checkbox" checked={whatIf.includes(g.skill)} onChange={() => setWhatIf(whatIf.includes(g.skill) ? whatIf.filter((x) => x !== g.skill) : [...whatIf, g.skill])} className="mt-1" />
                      <span><b>{g.skill}</b> <Chip tone={g.priority}>{g.priority}</Chip><br /><span style={{ color: "#3F4A63" }}>{g.whyItMatters}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </Reveal>

          <div className="card mt-3 flex flex-col gap-3 border p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5" style={{ background: "#EAF0FF", borderColor: "#C9D6FF" }}>
            <div className="flex min-w-0 items-start gap-2">
            <FlaskConical size={20} color="#1E40D8" className="mt-0.5 shrink-0" />
            <div className="min-w-0 text-[13.5px]" style={{ color: "#0E1525" }}>
              <b>What-if simulator (simulated, not a hiring promise):</b> tick gaps above.
              {whatIf.length > 0 ? <> Learning <b>{whatIf.join(", ")}</b> lifts best match to <span className="font-data font-bold" style={{ color: "#1E40D8" }}>{best ? lifted(best) : 0}%</span> (was {best?.matchScore}%).</> : " Tick a missing skill on any card to preview the lift."}
            </div>
            </div>
            <a href="/roadmap" className="btn-primary flex min-h-[44px] items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] sm:ml-auto">Build roadmap <ArrowRight size={14} /></a>
          </div>

          <Reveal delay={100} className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="card min-w-0 p-4 sm:p-5">
              <div className="font-display text-[16px] font-bold">Recommended roles for you</div>
              <div className="mt-2.5 grid gap-2">{recs.map((r) => <div key={r.role} className="text-[13px] break-words" style={{ color: "#3F4A63" }}><b style={{ color: "#0E1525" }}>{r.role}</b> — {r.why} {r.lift}</div>)}</div>
            </div>
            <div className="card min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-display text-[16px] font-bold">Resume wording fixes</div><button onClick={loadImprove} disabled={improving} className="flex min-h-[40px] items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[12px] font-bold disabled:opacity-60" style={{ borderColor: "#E2E8F2" }}>{improving ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} {improving ? "Writing…" : "Generate"}</button></div>
              {!improve && !improving && <div className="mt-2 text-[13px]" style={{ color: "#3F4A63" }}>Grounded rewrites only — no invented experience, ever.</div>}
              {improving && <div className="mt-2.5 grid gap-2" aria-hidden><Skeleton style={{ height: 58 }} /><Skeleton style={{ height: 58 }} /><Skeleton style={{ height: 58 }} /></div>}
              {improve && <div className="mt-2.5 grid gap-2">{improve.suggestions.map((s, i) => <div key={i} className="min-w-0 break-words rounded-[10px] border px-3 py-2 text-[12.5px]" style={{ borderColor: "#E2E8F2" }}><b>{s.section}:</b> <span style={{ color: "#3F4A63" }}>{s.before}</span><br />→ <b>{s.after}</b><br /><span className="italic" style={{ color: "#3F4A63" }}>{s.reason}</span></div>)}{improve.aiRewrite && <div className="rounded-[10px] p-3 text-[12.5px] whitespace-pre-wrap break-words" style={{ background: "#F2F5FF" }}>{improve.aiRewrite}</div>}</div>}
            </div>
          </Reveal>
        </>
      )}
      {jobs.length === 0 && !busy && (
        history.length > 0 ? (
          <div className="card mt-3 min-w-0 p-4 sm:p-5">
            <div className="font-display text-[16px] font-bold">Recent saved matches</div>
            <div className="mt-2.5 grid gap-2">
              {history.map((h) => (
                <a key={h.id} href={`/jobs/${h.id}`} className="flex min-w-0 items-center gap-3 rounded-[10px] border px-3.5 py-2.5 hover:border-[#2B5CFF]" style={{ borderColor: "#E2E8F2" }}>
                  <span className="font-data shrink-0 text-[15px] font-bold" style={{ color: "#1E40D8" }}>{h.result?.matchScore ?? "—"}%</span>
                  <span className="min-w-0 flex-1"><b className="block truncate text-[13.5px]">{h.title}</b><span className="block truncate text-[12px]" style={{ color: "#3F4A63" }}>{h.company} · {new Date(h.created_at).toLocaleDateString()}</span></span>
                  <ArrowRight size={14} color="#2B5CFF" className="shrink-0" />
                </a>
              ))}
            </div>
            <div className="mt-3 text-[13px]" style={{ color: "#3F4A63" }}>…or paste a JD above. Match = (have + 0.5×partial) / JD skills.</div>
          </div>
        ) : (
          <div className="card mt-3 min-w-0 p-4 sm:p-5"><Meter value={0} /><div className="mt-2 text-[13px]" style={{ color: "#3F4A63" }}>No comparisons yet — paste a JD above. Match = (have + 0.5×partial) / JD skills.</div></div>
        )
      )}
      {cachedNote && jobs.length > 0 && !busy && (
        <div className="mt-3 rounded-[10px] px-3.5 py-2.5 text-[12.5px] font-medium" style={{ background: "#E6F7EE", color: "#0B7A55" }}>
          Loaded from your saved results. Change the JD or skills to recompute.
        </div>
      )}
    </AppShell>
  );
}
