"use client";
import React from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/shell";
import { ChatThinking } from "@/components/loading";
import { Send, Bot, Plus, Trash2, MessageSquare, PanelLeft, X, Sparkles } from "lucide-react";
import type { ChatSession } from "@/lib/store";

/** Assistant replies render as formatted markdown in the dossier voice. */
function AssistantText({ text }: { text: string }) {
  return (
    <div className="markdown text-[13.5px] leading-6 [overflow-wrap:anywhere]">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          h1: ({ children }) => <div className="mb-1.5 mt-1 text-[15px] font-bold">{children}</div>,
          h2: ({ children }) => <div className="mb-1.5 mt-1 text-[14.5px] font-bold">{children}</div>,
          h3: ({ children }) => <div className="mb-1 mt-1 text-[14px] font-bold">{children}</div>,
          code: ({ children }) => (
            <code className="font-data rounded-md px-1.5 py-0.5 text-[12px] font-bold" style={{ background: "#EAF0FF", color: "#1E40D8" }}>{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="font-data mb-2 overflow-x-auto rounded-[10px] border p-3 text-[12px] leading-5" style={{ borderColor: "#E2E8F2", background: "#F7F9FF" }}>{children}</pre>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2" style={{ color: "#1E40D8" }}>{children}</a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 pl-3 italic" style={{ borderColor: "#2B5CFF" }}>{children}</blockquote>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function SessionList({ sessions, activeId, onSelect, onDelete }: {
  sessions: ChatSession[]; activeId: string | null;
  onSelect: (id: string) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="grid content-start gap-1.5">
      {sessions.length === 0 && (
        <div className="px-1 py-3 text-center text-[12px]" style={{ color: "#3F4A63" }}>No chats yet.<br />Every conversation is saved here, privately.</div>
      )}
      {sessions.map((s) => (
        <div key={s.id} role="button" tabIndex={0}
          onClick={() => onSelect(s.id)}
          onKeyDown={(e) => { if (e.key === "Enter") onSelect(s.id); }}
          aria-current={s.id === activeId ? true : undefined}
          className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2.5 text-left"
          style={s.id === activeId
            ? { borderColor: "#2B5CFF", background: "#F2F5FF" }
            : { borderColor: "#E2E8F2", background: "#fff" }}>
          <MessageSquare size={14} className="shrink-0" color={s.id === activeId ? "#1E40D8" : "#8B95B0"} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold">{s.title}</span>
            <span className="font-data block text-[10px]" style={{ color: "#8B95B0" }}>
              {s.messages.length} MSGS · {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
            aria-label={`Delete ${s.title}`} title="Delete chat"
            className="shrink-0 rounded-md p-1 opacity-0 hover:bg-red-50 focus:opacity-100 group-hover:opacity-100" style={{ color: "#DC2626" }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AssistantPage() {
  const { profile, jobs, chat, pushChat, sessions, activeId, newChatSession, selectSession, deleteSession } = useApp();
  const { user } = useAuth();
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const bottom = React.useRef<HTMLDivElement>(null);
  const box = React.useRef<HTMLTextAreaElement>(null);

  const active = sessions.find((s) => s.id === activeId);

  React.useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chat, busy, activeId]);

  function autogrow() {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  async function send(preset?: string) {
    const text = (preset ?? msg).trim();
    if (!text || busy) return;
    pushChat({ role: "user", text });
    setMsg("");
    if (box.current) box.current.style.height = "auto";
    setDrawer(false);
    setBusy(true);
    try {
      const r = await fetch("/api/ai?kind=chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, history: [...chat, { role: "user", text }].slice(-8), message: text }) });
      const j = await r.json();
      pushChat({ role: "assistant", text: j.reply ?? "Empty reply — try again." });
    } catch {
      pushChat({ role: "assistant", text: "Send failed — check your connection and try again." });
    } finally { setBusy(false); }
  }

  const presets = [
    "What are my top 2 skill gaps and why do they matter?",
    "Which job should I target first?",
    "What should I learn first and what project proves it?",
  ];

  const first = (profile?.name ?? "").split(" ")[0] || "there";
  const skillBit = !profile ? "" : profile.skills.length === 0
    ? "no skills mapped yet"
    : `${profile.skills.length} skill${profile.skills.length === 1 ? "" : "s"} mapped`;
  const jobBit = jobs.length === 0
    ? "no comparisons yet"
    : `${jobs.length} job${jobs.length === 1 ? "" : "s"} compared`;

  return (
    <AppShell requireAuth title="Career assistant" sub={profile ? `Advising ${first} · ${skillBit} · ${jobBit}. Every answer stays inside your resume.` : "Upload a resume to make me profile-aware."}>
      <div className="grid items-start gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Desktop session rail — sticky, self-scrolling, truncation-safe */}
        <aside className="card sticky top-6 hidden max-h-[calc(100dvh-3rem)] min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3 lg:grid" aria-label="Chat sessions">
          <button onClick={newChatSession} className="btn-primary flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px]">
            <Plus size={15} /> New chat
          </button>
          <div className="min-h-0 overflow-y-auto pr-0.5">
            <SessionList sessions={sessions} activeId={activeId} onSelect={selectSession} onDelete={deleteSession} />
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-label="Chat sessions">
            <div className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col gap-3 overflow-y-auto bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="font-display text-[15px] font-bold">Chats</span>
                <button onClick={() => setDrawer(false)} aria-label="Close chats" className="rounded-lg p-1.5 hover:bg-black/5"><X size={16} /></button>
              </div>
              <button onClick={() => { newChatSession(); setDrawer(false); }} className="btn-primary flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px]">
                <Plus size={15} /> New chat
              </button>
              <SessionList sessions={sessions} activeId={activeId}
                onSelect={(id) => { selectSession(id); setDrawer(false); }}
                onDelete={deleteSession} />
            </div>
          </div>
        )}

        {/* Chat column */}
        <div className="card flex min-h-[62vh] min-w-0 flex-col overflow-hidden">
          <header className="flex min-w-0 items-center gap-2.5 border-b px-4 py-3" style={{ borderColor: "#E2E8F2" }}>
            <button onClick={() => setDrawer(true)} aria-label="Open chats" className="rounded-lg border p-2 lg:hidden" style={{ borderColor: "#E2E8F2" }}>
              <PanelLeft size={15} />
            </button>
            <Image src="/logo.png" alt="" width={28} height={28} className="shrink-0 rounded-[8px]" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold">{active?.title ?? "New chat"}</div>
              <div className="font-data text-[10px] font-bold" style={{ color: "#0E9F6E" }}>
                {busy ? "THINKING…" : `${chat.length} MESSAGES · GROUNDED IN YOUR PROFILE`}
              </div>
            </div>
            <button onClick={newChatSession} aria-label="New chat" title="New chat" className="shrink-0 rounded-[10px] border p-2 hover:border-[#2B5CFF]" style={{ borderColor: "#E2E8F2" }}>
              <Plus size={15} />
            </button>
          </header>

          <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4" aria-live="polite">
            {chat.length === 0 && (
              <div className="grid justify-items-center gap-3 py-8 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "#EAF0FF" }}>
                  <Sparkles size={22} color="#1E40D8" />
                </span>
                <div className="font-display max-w-[38ch] text-[17px] font-bold leading-snug">Ask about skills, jobs, projects, or direction</div>
                <div className="flex max-w-[560px] flex-wrap justify-center gap-2">
                  {presets.map((p) => <button key={p} onClick={() => send(p)} className="rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors hover:border-[#2B5CFF] hover:bg-[#F7F9FF]" style={{ borderColor: "#E2E8F2", background: "#fff" }}>{p}</button>)}
                </div>
              </div>
            )}
            {chat.map((m, i) => m.role === "user" ? (
              <div key={`${activeId}-${i}`} className="flex justify-end gap-2">
                <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px] leading-6 text-white [overflow-wrap:anywhere]" style={{ background: "#2B5CFF" }}>
                  {m.text}
                </div>
                <span className="font-display grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: "#0E1525" }} aria-hidden>
                  {(user?.email ?? profile?.name ?? "?").trim().charAt(0).toUpperCase()}
                </span>
              </div>
            ) : (
              <div key={`${activeId}-${i}`} className="flex gap-2.5">
                <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-[8px]" />
                <div className="min-w-0 max-w-[92%] flex-1 rounded-2xl rounded-tl-md border px-4 py-3" style={{ borderColor: "#E2E8F2", background: "#fff" }}>
                  <AssistantText text={m.text} />
                </div>
              </div>
            ))}
            {busy && <ChatThinking />}
            <div ref={bottom} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t p-3" style={{ borderColor: "#E2E8F2" }}>
            <div className="flex items-end gap-2 rounded-2xl border p-2 pl-4 focus-within:border-[#2B5CFF]" style={{ borderColor: "#E2E8F2", background: "#F7F9FF" }}>
              <textarea
                ref={box} value={msg} rows={1}
                onChange={(e) => { setMsg(e.target.value); autogrow(); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask anything — gaps, roles, roadmap order…"
                aria-label="Ask assistant" disabled={busy}
                className="max-h-[140px] w-full resize-none bg-transparent py-2 text-[13.5px] leading-6 outline-none placeholder:text-[#8B95B0]"
              />
              <button type="submit" disabled={busy || !msg.trim()} aria-label="Send"
                className="btn-primary grid h-10 w-10 shrink-0 place-items-center rounded-xl disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
            <div className="mt-1.5 px-1 text-[11px]" style={{ color: "#8B95B0" }}>Enter to send · Shift+Enter for a new line · answers stay in this chat</div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
