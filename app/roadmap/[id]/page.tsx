import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Chip } from "@/components/shell";
import { authed, getRoadmap, getMatch } from "@/lib/server-db";
import type { RoadmapStep, SkillGap } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export default async function RoadmapDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authed();
  if (!auth) redirect(`/auth?next=${encodeURIComponent(`/roadmap/${id}`)}`);
  const row = await getRoadmap(auth.userId, auth.sb, id);
  if (!row || !Array.isArray(row.steps)) notFound();

  const steps = row.steps as RoadmapStep[];
  const gaps = Array.isArray(row.gaps) ? (row.gaps as SkillGap[]) : [];
  let jobLabel = "";
  if (typeof row.job_match_id === "string" && row.job_match_id) {
    const jm = await getMatch(auth.userId, auth.sb, row.job_match_id as string);
    if (jm) jobLabel = `${jm.title as string} @ ${jm.company as string}`;
  }

  return (
    <AppShell requireAuth title={(row.title as string) || "Saved roadmap"} sub={`${jobLabel ? `Pinned to ${jobLabel} · ` : ""}saved ${new Date(row.created_at as string).toLocaleString()} · each step ends with a provable artifact.`}>
      {gaps.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {gaps.filter((g) => g.status !== "have").map((g) => <Chip key={g.skill} tone={g.status === "missing" ? "missing" : "partial"}>{g.skill}</Chip>)}
        </div>
      )}
      <div className="grid gap-0">
        {steps.map((s, i) => (
          <div key={s.order} className="grid gap-2 sm:grid-cols-[64px_1fr] sm:gap-3">
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
      <Link href="/roadmap" className="mt-2 inline-flex items-center gap-1.5 rounded-[12px] border px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: "#E2E8F2" }}><ArrowLeft size={14} /> All roadmaps</Link>
    </AppShell>
  );
}
