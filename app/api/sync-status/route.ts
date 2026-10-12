import { NextResponse } from "next/server";
import { authed, bust } from "@/lib/server-db";

// GET /api/sync-status — proves whether cloud sync can work:
// auth session, each table reachable, canonical profile present.
// Used by the Profile sync card to turn silent failures into fixes.
const TABLES = ["profiles", "analyses", "job_matches", "roadmaps", "quiz_attempts", "ai_cache", "chat_sessions"] as const;

export async function GET() {
  const auth = await authed().catch(() => null);
  if (!auth) return NextResponse.json({ signedIn: false });
  const sb = auth.sb as unknown as {
    from: (t: string) => {
      select: (c: string, o: unknown) => {
        eq: (c: string, v: unknown) => { limit: (n: number) => Promise<{ count: number | null; error: { message: string } | null }> };
      };
    };
  };
  const tables: Record<string, { ok: boolean; detail?: string; count?: number }> = {};
  for (const t of TABLES) {
    try {
      const r = await sb.from(t).select("id", { count: "exact", head: true }).eq("user_id", auth.userId).limit(1);
      tables[t] = r.error
        ? { ok: false, detail: r.error.message.slice(0, 120) }
        : { ok: true, count: r.count ?? undefined };
    } catch (e) {
      tables[t] = { ok: false, detail: e instanceof Error ? e.message.slice(0, 120) : "probe failed" };
    }
  }
  const missing = Object.entries(tables).filter(([, v]) => !v.ok).map(([k]) => k);
  // Fresh reads after a schema run — drop stale negative caches.
  if (missing.length === 0) bust("");
  return NextResponse.json({ signedIn: true, userId: auth.userId, tables, missing });
}
