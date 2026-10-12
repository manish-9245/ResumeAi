import { NextResponse } from "next/server";
import { authed, deleteChatRow, listChats, upsertChats, type ChatRow } from "@/lib/server-db";

// GET: all chat sessions for this user (cross-device restore).
// POST: replace-or-insert sessions [{id,title,messages,createdAt,updatedAt}].
// DELETE ?id=: remove one session.
export async function GET() {
  try {
    const auth = await authed().catch(() => null);
    if (!auth) return NextResponse.json({ sessions: [] });
    const rows = await listChats(auth.userId, auth.sb).catch(() => []);
    const sessions = (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      title: String(r.title ?? "Chat"),
      messages: Array.isArray(r.messages) ? r.messages : [],
      createdAt: r.created_at ? Date.parse(String(r.created_at)) : Date.now(),
      updatedAt: r.updated_at ? Date.parse(String(r.updated_at)) : Date.now(),
    }));
    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    const auth = await authed().catch(() => null);
    if (!auth) return NextResponse.json({ saved: false });
    const clean: ChatRow[] = sessions.slice(0, 20).map((s: Record<string, unknown>) => ({
      id: String(s.id ?? ""),
      title: String(s.title ?? "Chat").slice(0, 80),
      messages: Array.isArray(s.messages)
        ? (s.messages as Record<string, unknown>[]).slice(0, 200).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            text: String(m.text ?? "").slice(0, 4000),
          }))
        : [],
      createdAt: Number(s.createdAt) || Date.now(),
      updatedAt: Number(s.updatedAt) || Number(s.createdAt) || Date.now(),
    })).filter((s: ChatRow) => s.id);
    const ok = await upsertChats(auth.userId, auth.sb, clean).catch(() => false);
    return NextResponse.json({ saved: ok });
  } catch {
    return NextResponse.json({ saved: false });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const auth = await authed().catch(() => null);
    if (!auth) return NextResponse.json({ deleted: false });
    if (searchParams.get("all") === "1") {
      const sb = auth.sb as unknown as {
        from: (t: string) => { delete: () => { eq: (c: string, v: unknown) => Promise<unknown> } };
      };
      await sb.from("chat_sessions").delete().eq("user_id", auth.userId).catch(() => {});
      const { bust } = await import("@/lib/server-db");
      bust(`chats:${auth.userId}`);
      return NextResponse.json({ deleted: true });
    }
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ deleted: false });
    await deleteChatRow(auth.userId, auth.sb, id).catch(() => {});
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ deleted: false });
  }
}
