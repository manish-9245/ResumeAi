"use client";
import React from "react";
import { useApp } from "@/lib/store";
import { AppShell, Empty, Chip } from "@/components/shell";
import { QuizSkeleton } from "@/components/loading";
import { ALL_SKILLS } from "@/lib/skills";
import type { QuizQ } from "@/lib/types";
import { Loader2, BadgeCheck, ListChecks, Check } from "lucide-react";

const COUNTS = [4, 6, 8, 10];

export default function QuizPage() {
  const { profile, setQuiz, setVerified } = useApp();
  const [qs, setQs] = React.useState<QuizQ[]>([]);
  const [ans, setAns] = React.useState<Record<string, number>>({});
  const [idx, setIdx] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [setupOpen, setSetupOpen] = React.useState(true);
  const [topics, setTopics] = React.useState<string[]>(profile?.skills ?? []);
  const [count, setCount] = React.useState(6);

  React.useEffect(() => {
    if (profile && topics.length === 0) setTopics(profile.skills);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.email]);

  async function gen() {
    if (!profile || !topics.length) return;
    setBusy(true); setDone(false); setAns({}); setIdx(0); setSetupOpen(false);
    try {
      const r = await fetch("/api/ai?kind=quiz", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: topics, count }),
      });
      const j = await r.json();
      setQs(j.questions ?? []); setQuiz(j.questions ?? []);
    } finally { setBusy(false); }
  }

  if (!profile) return <AppShell requireAuth title="Skill verification" sub="Resume claims vs. verified knowledge."><Empty title="Upload first" body="Quiz is generated from skills in your resume." action={<a href="/upload" className="btn-primary px-5 py-3 text-[14px]">Upload</a>} /></AppShell>;

  const claimed = profile.skills;
  const extras = ALL_SKILLS.filter((s) => !claimed.includes(s));
  const score = qs.filter((q) => ans[q.id] === q.answer).length;
  const answered = Object.keys(ans).length;
  const q = qs[idx];

  function toggle(t: string) {
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function pick(qid: string, k: number) {
    if (done) return;
    setAns((a) => ({ ...a, [qid]: k }));
    if (idx < qs.length - 1) setTimeout(() => setIdx((i) => Math.min(i + 1, qs.length - 1)), 280);
  }

  const [attemptId, setAttemptId] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<{ id: string; topics: string[]; score: number; count: number; created_at: string }[]>([]);

  React.useEffect(() => {
    fetch("/api/quiz-attempts?history=1").then((r) => r.json()).then((j) => setHistory(j.items ?? [])).catch(() => {});
  }, []);

  async function submit() {
    setDone(true);
    setVerified(score);
    // Persist metrics + full review → addressable at /quiz/[id]. No AI involved.
    try {
      const r = await fetch("/api/quiz-attempts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics, count: qs.length, questions: qs, answers: ans, score }),
      });
      const j = await r.json();
      if (j.id) {
        setAttemptId(j.id);
        setHistory((h) => [{ id: j.id, topics, score, count: qs.length, created_at: new Date().toISOString() }, ...h].slice(0, 10));
      }
    } catch {}
  }

  return (
    <AppShell requireAuth title="Skill verification quiz" sub="Pick your topics, answer one question at a time. Passing proves the resume — failing tells you exactly what to re-learn.">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setSetupOpen(true); setDone(false); }} className="flex items-center gap-2 rounded-[12px] border px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: "#E2E8F2", background: "#fff" }}>
          <ListChecks size={15} /> {qs.length ? "Change topics" : "Choose topics"}
        </button>
        {qs.length > 0 && !done && !setupOpen && (
          <span className="font-data text-[11px] font-bold" style={{ color: "#3F4A63" }}>{answered}/{qs.length} ANSWERED</span>
        )}
      </div>

      {/* Setup: all topics to choose from */}
      {setupOpen && !busy && (
        <div className="card card-elev rise mt-3 p-5 sm:p-6">
          <div className="font-display text-[16px] font-bold">What should we test?</div>
          <p className="mt-1 text-[13px]" style={{ color: "#3F4A63" }}>Your resume skills are pre-selected. Add anything else you want to prove.</p>

          <div className="font-data mt-4 text-[10px] font-bold tracking-[.14em]" style={{ color: "#3F4A63" }}>FROM YOUR RESUME ({claimed.length})</div>
          {claimed.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {claimed.map((t) => {
                const on = topics.includes(t);
                return (
                  <button key={t} onClick={() => toggle(t)} aria-pressed={on}
                    className="font-data flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-all"
                    style={on ? { borderColor: "#2B5CFF", background: "#2B5CFF", color: "#fff" } : { borderColor: "#E2E8F2", background: "#fff", color: "#0E1525" }}>
                    {on && <Check size={12} />} {t}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 text-[13px]" style={{ color: "#3F4A63" }}>No skills parsed — pick from all topics below.</div>
          )}

          <div className="font-data mt-4 text-[10px] font-bold tracking-[.14em]" style={{ color: "#3F4A63" }}>ALL TOPICS</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {extras.map((t) => {
              const on = topics.includes(t);
              return (
                <button key={t} onClick={() => toggle(t)} aria-pressed={on}
                  className="font-data rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all"
                  style={on ? { borderColor: "#0E9F6E", background: "#E6F7EE", color: "#0B7A55", fontWeight: 700 } : { borderColor: "#E2E8F2", background: "#fff", color: "#3F4A63" }}>
                  {on ? `✓ ${t}` : `+ ${t}`}
                </button>
              );
            })}
          </div>

          <div className="font-data mt-4 text-[10px] font-bold tracking-[.14em]" style={{ color: "#3F4A63" }}>QUESTIONS PER SKILL</div>
          <div className="mt-2 flex gap-1.5">
            {COUNTS.map((n) => (
              <button key={n} onClick={() => setCount(n)} aria-pressed={count === n}
                className="font-data h-10 min-w-11 rounded-[10px] px-3 text-[13px] font-bold"
                style={count === n ? { background: "#0B1220", color: "#fff" } : { background: "#F0F3F9", color: "#3F4A63" }}>{n}</button>
            ))}
          </div>

          <button onClick={gen} disabled={!topics.length}
            className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3 text-[14px] disabled:opacity-50">
            <BadgeCheck size={16} /> Start quiz — {topics.length} topic{topics.length === 1 ? "" : "s"} × {count} each = {topics.length * count} questions
          </button>
          {!topics.length && <div className="mt-2 text-center text-[12.5px] font-medium" style={{ color: "#B42323" }}>Pick at least one topic to start.</div>}
        </div>
      )}
      {busy && <div className="mt-3"><QuizSkeleton /></div>}

      {/* Running: one question at a time */}
      {!busy && !setupOpen && qs.length > 0 && !done && q && (
        <div className="mt-3 min-w-0">
          <div className="flex items-center gap-1" role="tablist" aria-label="Questions">
            {qs.map((item, i) => (
              <button
                key={item.id} role="tab" aria-selected={i === idx} aria-label={`Question ${i + 1}${ans[item.id] !== undefined ? " (answered)" : ""}`}
                onClick={() => setIdx(i)}
                className="grid min-h-[28px] flex-1 place-items-center px-0.5"
              >
                <span
                  className="h-2 w-full rounded-full transition-all"
                  style={{ background: ans[item.id] !== undefined ? "#0E9F6E" : i === idx ? "#2B5CFF" : "#E2E8F2" }}
                />
              </button>
            ))}
          </div>

          <div key={q.id} className="card card-elev rise mt-3 min-w-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold" style={{ color: "#3F4A63" }}>
              <span className="font-data">Q{idx + 1} / {qs.length}</span> <Chip tone="info">{q.skill}</Chip>
            </div>
            <div className="font-display mt-2 text-[17px] font-bold leading-snug sm:text-[19px]">{q.question}</div>
            <div className="mt-4 grid gap-2">
              {q.options.map((o, k) => {
                const picked = ans[q.id] === k;
                return (
                  <button key={k} onClick={() => pick(q.id, k)}
                    aria-pressed={picked}
                    className="min-w-0 rounded-[12px] border px-4 py-3 text-left text-[14px] font-medium transition-all"
                    style={{ borderColor: picked ? "#2B5CFF" : "#E2E8F2", background: picked ? "#F2F5FF" : "#fff", borderWidth: picked ? 2 : 1, padding: picked ? "11px 15px" : undefined }}>
                    <span className="font-data mr-2.5 font-bold" style={{ color: picked ? "#1E40D8" : "#3F4A63" }}>{String.fromCharCode(65 + k)}</span> {o}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
                className="min-h-[44px] rounded-[12px] border px-4 py-2.5 text-[13px] font-bold disabled:opacity-40" style={{ borderColor: "#E2E8F2", background: "#fff" }}>
                ← Back
              </button>
              {idx < qs.length - 1 ? (
                <button onClick={() => setIdx((i) => Math.min(qs.length - 1, i + 1))}
                  className="min-h-[44px] rounded-[12px] border px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: "#2B5CFF", color: "#1E40D8", background: "#fff" }}>
                  Skip →
                </button>
              ) : (
                <button onClick={submit} disabled={answered < qs.length}
                  className="btn-primary min-h-[44px] px-6 py-2.5 text-[13px] disabled:opacity-50" title={answered < qs.length ? `Answer ${qs.length - answered} more to submit` : "Submit quiz"}>
                  Submit ({answered}/{qs.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Done: score + full review */}
      {done && (
        <div className="card mt-3 min-w-0 p-4 rise sm:p-5" style={{ background: score >= Math.ceil(qs.length * 0.65) ? "#E6F7EE" : "#FFF4D6", borderColor: score >= Math.ceil(qs.length * 0.65) ? "#0E9F6E" : "#B45309" }}>
          <div className="font-display text-[18px] font-bold leading-snug sm:text-[20px]">{score}/{qs.length} verified {score >= Math.ceil(qs.length * 0.65) ? "— claims hold up." : "— re-learn the misses below."}</div>
          <div className="mt-1 text-[13px]" style={{ color: "#3F4A63" }}>
            Saved to your dashboard as Verified Skills{attemptId ? <> + stored as <a href={`/quiz/${attemptId}`} className="font-bold" style={{ color: "#1E40D8" }}>permanent review ↗</a></> : " (sign in to keep a permanent review link)"}. Retake anytime after studying the roadmap.
          </div>
        </div>
      )}
      {done && (
        <div className="mt-3 grid gap-2.5">
          {qs.map((item, i) => (
            <div key={item.id} className="card min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold" style={{ color: "#3F4A63" }}><span className="font-data">Q{i + 1}</span> <Chip tone="info">{item.skill}</Chip></div>
              <div className="font-display mt-1.5 text-[15px] font-bold leading-snug sm:text-[15.5px]">{item.question}</div>
              <div className="mt-2.5 grid gap-1.5">
                {item.options.map((o, k) => {
                  const picked = ans[item.id] === k;
                  const showRight = item.answer === k;
                  const showWrong = picked && k !== item.answer;
                  return (
                    <div key={k}
                      className="rounded-[10px] border px-3.5 py-2.5 text-[13.5px] font-medium"
                      style={{ borderColor: showRight ? "#0E9F6E" : showWrong ? "#DC2626" : "#E2E8F2", background: showRight ? "#E6F7EE" : showWrong ? "#FDE8E8" : "#fff" }}>
                      <span className="font-data mr-2 font-bold">{String.fromCharCode(65 + k)}</span> {o}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[12.5px] italic" style={{ color: "#3F4A63" }}>{item.explain}</div>
            </div>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div className="card mt-3 min-w-0 p-4 sm:p-5">
          <div className="font-display text-[15px] font-bold">Past attempts</div>
          <div className="mt-2.5 grid gap-2">
            {history.map((h) => (
              <a key={h.id} href={`/quiz/${h.id}`} className="flex min-w-0 items-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] hover:border-[#2B5CFF]" style={{ borderColor: "#E2E8F2" }}>
                <span className="font-data shrink-0 font-bold" style={{ color: h.score >= Math.ceil(h.count * 0.65) ? "#0B7A55" : "#92580A" }}>{h.score}/{h.count}</span>
                <span className="min-w-0 flex-1 truncate" style={{ color: "#3F4A63" }}>{(h.topics ?? []).slice(0, 4).join(", ")}</span>
                <span className="shrink-0" style={{ color: "#3F4A63" }}>{new Date(h.created_at).toLocaleDateString()}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
