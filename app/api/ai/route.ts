import { NextResponse } from "next/server";
import { aiRoadmap, aiQuiz, aiImprove, aiChat, aiRoles } from "@/lib/gemini";
import { aiCacheGet, aiCacheSet, authed, findRoadmap, saveRoadmap, sha } from "@/lib/server-db";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "roadmap";
  try {
    const body = await req.json();
    if (kind === "roadmap") {
      const gaps = body.gaps ?? [];
      const jobMatchId = typeof body.jobMatchId === "string" && body.jobMatchId ? body.jobMatchId : null;
      const gapSig = [...gaps].map((g: { skill: string; status: string }) => `${g.skill}:${g.status}`).sort().join("|").toLowerCase();
      const key = jobMatchId ? `job:${jobMatchId}` : `gaps:${sha(gapSig)}`;
      const auth = await authed().catch(() => null);
      if (auth) {
        const hit = await findRoadmap(auth.userId, auth.sb, key).catch(() => null);
        if (hit) return NextResponse.json({ steps: hit.steps, roadmapId: hit.id, title: hit.title, cached: true });
      }
      const r = await aiRoadmap(body.profile, gaps);
      let roadmapId: string | null = null;
      if (auth) {
        const title = jobMatchId ? `Roadmap` : `Roadmap · ${new Date().toLocaleDateString()}`;
        roadmapId = await saveRoadmap(auth.userId, auth.sb, {
          job_match_id: jobMatchId, title, gaps, steps: r.steps, cache_key: key,
        }).catch(() => null);
      }
      return NextResponse.json({ ...r, roadmapId, cached: false });
    }
    if (kind === "quiz") return NextResponse.json(await aiQuiz(body.skills ?? [], Math.min(10, Math.max(3, Number(body.count) || 6))));
    if (kind === "improve") {
      const sig = sha(JSON.stringify({ s: (body.profile?.skills ?? []).sort(), p: (body.profile?.projects ?? []).slice(0, 2) }));
      const auth = await authed().catch(() => null);
      if (auth) {
        const hit = await aiCacheGet(auth.userId, auth.sb, `improve:${sig}`).catch(() => null);
        if (hit?.value) return NextResponse.json({ ...(hit.value as object), cached: true });
      }
      const r = await aiImprove(body.profile);
      if (auth) await aiCacheSet(auth.userId, auth.sb, `improve:${sig}`, r).catch(() => {});
      return NextResponse.json({ ...r, cached: false });
    }
    if (kind === "chat") return NextResponse.json(await aiChat(body.profile ?? null, body.history ?? [], body.message ?? ""));
    if (kind === "roles") {
      if (!body.profile) return NextResponse.json({ error: "profile required." }, { status: 400 });
      const p = body.profile as { skills?: string[]; experience?: string[]; projects?: string[] };
      const sig = sha(JSON.stringify({ s: [...(p.skills ?? [])].sort(), e: p.experience ?? [], p: p.projects ?? [] }));
      const auth = await authed().catch(() => null);
      if (auth) {
        const hit = await aiCacheGet(auth.userId, auth.sb, `roles:${sig}`).catch(() => null);
        if (hit?.value) return NextResponse.json({ ...(hit.value as object), cached: true });
      }
      const r = await aiRoles(body.profile);
      if (auth) await aiCacheSet(auth.userId, auth.sb, `roles:${sig}`, r).catch(() => {});
      return NextResponse.json({ ...r, cached: false });
    }
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "AI request failed." }, { status: 500 });
  }
}
