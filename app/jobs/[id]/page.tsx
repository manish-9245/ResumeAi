import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, ScoreDial, Chip } from "@/components/shell";
import { authed, getMatch } from "@/lib/server-db";
import type { JobMatch } from "@/lib/types";
import { ArrowLeft, Map } from "lucide-react";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authed();
  if (!auth) redirect(`/auth?next=${encodeURIComponent(`/jobs/${id}`)}`);
  const row = await getMatch(auth.userId, auth.sb, id);
  if (!row || !row.result || typeof row.result !== "object") notFound();

  const m = row.result as JobMatch;
  const strategy = typeof row.strategy === "string" ? (row.strategy as string) : "";

  return (
    <AppShell requireAuth title={m.title || "Match detail"} sub={`${m.company || "Company"} · saved ${new Date(row.created_at as string).toLocaleString()} · decision-support, not a verdict.`}>
      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <div className="card card-elev flex flex-col items-center gap-2 p-4 sm:p-6">
          <ScoreDial value={m.matchScore} label="MATCH" />
          <div className="font-data text-[11px]" style={{ color: "#3F4A63" }}>SAVED · {String(id).slice(0, 8).toUpperCase()}</div>
        </div>
        <div className="card grid min-w-0 content-center gap-3 p-4 sm:p-6">
          <div className="text-[14px] italic break-words" style={{ color: "#3F4A63" }}>{m.verdict}</div>
          <div className="flex flex-wrap gap-1.5">
            {m.matched.map((s) => <Chip key={`h-${s}`} tone="have">{s}</Chip>)}
            {m.partial.map((s) => <Chip key={`p-${s}`} tone="partial">~{s}</Chip>)}
            {m.missing.map((s) => <Chip key={`m-${s}`} tone="missing">+{s}</Chip>)}
          </div>
          {strategy && <div className="rounded-[10px] px-3.5 py-2.5 text-[13px] break-words" style={{ background: "#E4EBFF", color: "#1E40D8" }}>{strategy}</div>}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link href="/jobs" className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[12px] border px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: "#E2E8F2" }}><ArrowLeft size={14} /> All matches</Link>
            <Link href={`/roadmap?job=${id}`} className="btn-primary flex min-h-[44px] items-center justify-center gap-1.5 px-4 py-2.5 text-[13px]"><Map size={14} /> Roadmap for this job</Link>
          </div>
        </div>
      </div>
      <div className="card mt-3 min-w-0 p-4 sm:p-6">
        <div className="font-display text-[16px] font-bold">Skill gaps</div>
        <div className="mt-3 grid gap-2">
          {m.gaps.map((g) => (
            <div key={g.skill} className="flex flex-wrap items-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px]" style={{ borderColor: "#E2E8F2" }}>
              <b className="font-data">{g.skill}</b>
              <Chip tone={g.status === "have" ? "have" : g.status === "partial" ? "partial" : "missing"}>{g.status}</Chip>
              <Chip tone={g.priority}>{g.priority}</Chip>
              <span className="basis-full text-[12.5px]" style={{ color: "#3F4A63" }}>{g.whyItMatters}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
