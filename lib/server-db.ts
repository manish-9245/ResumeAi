import "server-only";
import { createHash } from "crypto";
import { createClient } from "@/utils/supabase/server";

/** Deterministic content hash for AI-result dedupe (saves Gemini tokens). */
export function sha(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

export function dbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

type SB = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export async function authed(): Promise<{ sb: SB; userId: string } | null> {
  if (!dbConfigured()) return null;
  try {
    const sb = await createClient();
    if (!sb) return null;
    const { data } = await (sb as unknown as { auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> } }).auth.getUser();
    if (!data.user) return null;
    return { sb: sb as unknown as SB, userId: data.user.id };
  } catch {
    return null;
  }
}

// ---- Tiny in-process read cache: avoids repeat DB hits within TTL. ----
const mem = new Map<string, { at: number; data: unknown }>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    // LRU touch: reused keys stay, idle keys age out first.
    mem.delete(key);
    mem.set(key, hit);
    return hit.data as T;
  }
  const data = await fn();
  mem.set(key, { at: Date.now(), data });
  if (mem.size > 500) mem.delete(mem.keys().next().value as string);
  return data;
}

export function bust(prefix: string) {
  for (const k of mem.keys()) if (k.startsWith(prefix)) mem.delete(k);
}

// ---- Eviction: cap stored rows per user so a new scan replaces old state
// instead of piling up. Best-effort — saves have already succeeded.
/** Keep the newest `keep` rows of `tbl` for this user (RLS-scoped), delete the rest. */
async function evictBeyondCap(sb: SB, tbl: string, userId: string, keep: number, idCol = "id"): Promise<void> {
  try {
    const t = await table(sb);
    const sel = t.from(tbl).select(idCol) as unknown as {
      eq: (c: string, v: unknown) => {
        order: (c: string, o?: { ascending?: boolean }) => {
          range: (a: number, b: number) => Promise<{ data: Record<string, string>[] | null }>;
        };
      };
    };
    const { data } = await sel.eq("user_id", userId).order("created_at", { ascending: false }).range(keep, keep + 99);
    const ids = (data ?? []).map((r) => r[idCol]).filter(Boolean);
    if (!ids.length) return;
    const del = (t.from(tbl) as unknown as {
      delete: () => { eq: (c: string, v: unknown) => { in: (c: string, v: unknown[]) => Promise<unknown> } };
    }).delete();
    await del.eq("user_id", userId).in(idCol, ids);
  } catch { /* eviction is hygiene, never a save failure */ }
}

type Row = Record<string, unknown>;
async function table(sb: SB): Promise<{
  from: (t: string) => {
    select: (c: string) => unknown;
    insert: (v: unknown) => { select: (c: string) => Promise<{ data: Row[] | null; error: unknown }> } & Promise<{ data: Row[] | null; error: unknown }>;
    upsert: (v: unknown, o?: unknown) => Promise<{ data: Row[] | null; error: unknown }>;
  };
}> {
  return sb as unknown as {
    from: (t: string) => {
      select: (c: string) => unknown;
      insert: (v: unknown) => { select: (c: string) => Promise<{ data: Row[] | null; error: unknown }> } & Promise<{ data: Row[] | null; error: unknown }>;
      upsert: (v: unknown, o?: unknown) => Promise<{ data: Row[] | null; error: unknown }>;
    };
  };
}

interface Q {
  eq: (c: string, v: unknown) => Q;
  order: (c: string, o?: unknown) => Q;
  limit: (n: number) => Q;
  single: () => Promise<{ data: Row | null }>;
  then: (r: (v: { data: Row[] | null }) => unknown) => Promise<unknown>;
}

// -- Analyses (resume-hash dedupe) --
export async function findAnalysis(userId: string, sb: SB, hash: string): Promise<Row | null> {
  return cached(`an:${userId}:${hash}`, 5 * 60 * 1000, async () => {
    try {
      const t = await table(sb);
      const q = t.from("analyses").select("*") as unknown as Q;
      const { data } = await q.eq("user_id", userId).eq("resume_hash", hash).limit(1).single();
      return data;
    } catch { return null; }
  });
}

export async function saveAnalysis(userId: string, sb: SB, row: { resume_hash: string; resume_text: string; parsed: unknown; health: unknown; ai_note: string }): Promise<string | null> {
  try {
    const t = await table(sb);
    const { data } = await t.from("analyses").upsert(
      { user_id: userId, ...row },
      { onConflict: "user_id,resume_hash" }
    );
    bust(`an:${userId}:`);
    await evictBeyondCap(sb, "analyses", userId, 20);
    return (data?.[0]?.id as string) ?? null;
  } catch { return null; }
}

// -- Job matches (JD+skills hash dedupe) --
export async function findMatch(userId: string, sb: SB, jdHash: string): Promise<Row | null> {
  return cached(`jm:${userId}:${jdHash}`, 5 * 60 * 1000, async () => {
    try {
      const t = await table(sb);
      const q = t.from("job_matches").select("*") as unknown as Q;
      const { data } = await q.eq("user_id", userId).eq("jd_hash", jdHash).order("created_at", { ascending: false }).limit(1).single();
      return data;
    } catch { return null; }
  });
}

export async function saveMatch(userId: string, sb: SB, row: { title: string; company: string; jd: string; jd_hash: string; strategy: string; result: unknown }): Promise<string | null> {
  try {
    const t = await table(sb);
    const ins = t.from("job_matches").insert({ user_id: userId, ...row });
    const { data } = await ins.select("id");
    bust(`jm:${userId}:`);
    bust(`hist:${userId}:matches`);
    await evictBeyondCap(sb, "job_matches", userId, 30);
    return (data?.[0]?.id as string) ?? null;
  } catch { return null; }
}

export async function getMatch(userId: string, sb: SB, id: string): Promise<Row | null> {
  return cached(`jmrow:${userId}:${id}`, 60 * 1000, async () => {
    try {
      const t = await table(sb);
      const q = t.from("job_matches").select("*") as unknown as Q;
      const { data } = await q.eq("id", id).eq("user_id", userId).limit(1).single();
      return data;
    } catch { return null; }
  });
}

// -- Roadmaps (per-job or general, keyed) --
export async function findRoadmap(userId: string, sb: SB, key: string): Promise<Row | null> {
  return cached(`rm:${userId}:${key}`, 5 * 60 * 1000, async () => {
    try {
      const t = await table(sb);
      const q = t.from("roadmaps").select("*") as unknown as Q;
      const { data } = await q.eq("user_id", userId).eq("cache_key", key).order("created_at", { ascending: false }).limit(1).single();
      return data;
    } catch { return null; }
  });
}

export async function saveRoadmap(userId: string, sb: SB, row: { job_match_id: string | null; title: string; gaps: unknown; steps: unknown; cache_key: string }): Promise<string | null> {
  try {
    const t = await table(sb);
    const ins = t.from("roadmaps").insert({ user_id: userId, ...row });
    const { data } = await ins.select("id");
    bust(`rm:${userId}:`);
    bust(`hist:${userId}:roadmaps`);
    await evictBeyondCap(sb, "roadmaps", userId, 30);
    return (data?.[0]?.id as string) ?? null;
  } catch { return null; }
}

export async function getRoadmap(userId: string, sb: SB, id: string): Promise<Row | null> {
  return cached(`rmrow:${userId}:${id}`, 60 * 1000, async () => {
    try {
      const t = await table(sb);
      const q = t.from("roadmaps").select("*") as unknown as Q;
      const { data } = await q.eq("id", id).eq("user_id", userId).limit(1).single();
      return data;
    } catch { return null; }
  });
}

// -- Profile sync (one canonical row per user, last-write-wins) --
export async function getLatestProfile(userId: string, sb: SB): Promise<Row | null> {
  return cached(`prof:${userId}`, 30 * 1000, async () => {
    try {
      const t = await table(sb);
      const q = t.from("profiles").select("*") as unknown as Q;
      const { data } = await q.eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).single();
      return data;
    } catch { return null; }
  });
}

export async function upsertProfile(userId: string, sb: SB, row: { name: string; email: string; resume_text: string; parsed: unknown; health: unknown }): Promise<boolean> {
  try {
    const t = await table(sb);
    const payload = { user_id: userId, ...row, updated_at: new Date().toISOString() };
    let r = await t.from("profiles").upsert(payload, { onConflict: "user_id" });
    if (r.error) {
      // Unique constraint may predate this migration — plain insert still works (loader takes latest).
      r = await t.from("profiles").insert(payload);
      if (r.error) return false;
    }
    bust(`prof:${userId}`);
    return true;
  } catch { return false; }
}

// -- Chat sessions sync --
export interface ChatRow {
  id: string; title: string;
  messages: { role: string; text: string }[];
  createdAt: number; updatedAt: number;
}

export async function listChats(userId: string, sb: SB): Promise<Row[]> {
  return cached(`chats:${userId}`, 30 * 1000, async () => {
    try {
      const t = await table(sb);
      const q = t.from("chat_sessions").select("id,title,messages,created_at,updated_at") as unknown as Q;
      let out: Row[] = [];
      await q.eq("user_id", userId).order("updated_at", { ascending: false }).limit(20).then((v) => { out = v.data ?? []; });
      return out;
    } catch { return []; }
  });
}

export async function upsertChats(userId: string, sb: SB, chats: ChatRow[]): Promise<boolean> {
  try {
    const t = await table(sb);
    const rows = chats.slice(0, 20).map((c) => ({
      id: c.id, user_id: userId, title: c.title, messages: c.messages,
      created_at: new Date(c.createdAt || Date.now()).toISOString(),
      updated_at: new Date(c.updatedAt || c.createdAt || Date.now()).toISOString(),
    }));
    if (!rows.length) return true;
    const r = await t.from("chat_sessions").upsert(rows, { onConflict: "id" });
    if (r.error) return false;
    bust(`chats:${userId}`);
    return true;
  } catch { return false; }
}

export async function deleteChatRow(userId: string, sb: SB, id: string): Promise<void> {
  try {
    const t = await table(sb);
    const del = (t.from("chat_sessions") as unknown as {
      delete: () => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => Promise<unknown> } };
    }).delete();
    await del.eq("id", id).eq("user_id", userId);
    bust(`chats:${userId}`);
  } catch {}
}

// -- Quiz attempts (metrics) --
export async function saveQuizAttempt(userId: string, sb: SB, row: { topics: unknown; count: number; questions: unknown; answers: unknown; score: number }): Promise<string | null> {
  try {
    const t = await table(sb);
    const ins = t.from("quiz_attempts").insert({ user_id: userId, ...row });
    const { data } = await ins.select("id");
    bust(`hist:${userId}:attempts`);
    await evictBeyondCap(sb, "quiz_attempts", userId, 30);
    return (data?.[0]?.id as string) ?? null;
  } catch { return null; }
}

export async function getQuizAttempt(userId: string, sb: SB, id: string): Promise<Row | null> {
  return cached(`qarow:${userId}:${id}`, 60 * 1000, async () => {
    try {
      const t = await table(sb);
      const q = t.from("quiz_attempts").select("*") as unknown as Q;
      const { data } = await q.eq("id", id).eq("user_id", userId).limit(1).single();
      return data;
    } catch { return null; }
  });
}

// -- Generic AI cache (e.g. wording rewrites) --
export async function aiCacheGet(userId: string, sb: SB, key: string): Promise<Row | null> {
  return cached(`ac:${userId}:${key}`, 10 * 60 * 1000, async () => {
    try {
      const t = await table(sb);
      const q = t.from("ai_cache").select("*") as unknown as Q;
      const { data } = await q.eq("user_id", userId).eq("key", key).limit(1).single();
      return data;
    } catch { return null; }
  });
}

export async function aiCacheSet(userId: string, sb: SB, key: string, value: unknown): Promise<void> {
  try {
    const t = await table(sb);
    await t.from("ai_cache").upsert({ user_id: userId, key, value }, { onConflict: "user_id,key" });
    bust(`ac:${userId}:${key}`);
    await evictBeyondCap(sb, "ai_cache", userId, 50, "key");
  } catch {}
}

// -- History lists (cached reads) --
export async function listHistory(userId: string, sb: SB, kind: "matches" | "roadmaps" | "attempts", limit = 10): Promise<Row[]> {
  return cached(`hist:${userId}:${kind}:${limit}`, 45 * 1000, async () => {
    try {
      const t = await table(sb);
      const tbl = kind === "matches" ? "job_matches" : kind === "roadmaps" ? "roadmaps" : "quiz_attempts";
      const cols = kind === "matches" ? "id,title,company,created_at,result" : kind === "roadmaps" ? "id,title,created_at,job_match_id" : "id,topics,score,count,created_at";
      const q = t.from(tbl).select(cols) as unknown as Q;
      let out: Row[] = [];
      await q.eq("user_id", userId).order("created_at", { ascending: false }).limit(limit).then((v) => { out = v.data ?? []; });
      return out;
    } catch { return []; }
  });
}
