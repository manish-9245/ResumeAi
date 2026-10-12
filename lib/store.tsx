"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMsg, JobMatch, ParsedProfile, QuizQ } from "./types";
import { cleanName } from "./analysis";
import { useAuth } from "./auth";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMsg[];
}

interface ChatState {
  sessions: ChatSession[];
  activeId: string | null;
}

type ChatAction =
  | { type: "load"; sessions: ChatSession[] }
  | { type: "push"; msg: ChatMsg }
  | { type: "new" }
  | { type: "select"; id: string }
  | { type: "delete"; id: string }
  | { type: "clear" };

// Pure reducer: dispatch identity is stable, so rapid pushChat calls in one
// send() can never fork sessions on a stale closure (the old message-loss bug).
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "load":
      return { sessions: action.sessions, activeId: action.sessions[0]?.id ?? null };
    case "push": {
      const { msg } = action;
      if (!state.sessions.length) {
        const s = newSession(msg.role === "user" ? titleFrom(msg.text) : "New chat");
        s.messages = [msg];
        return { sessions: [s], activeId: s.id };
      }
      const id = state.activeId ?? state.sessions[0].id;
      return {
        sessions: state.sessions.map((s) => {
          if (s.id !== id) return s;
          const title = s.title === "New chat" && msg.role === "user" ? titleFrom(msg.text) : s.title;
          return { ...s, title, messages: [...s.messages, msg], updatedAt: Date.now() };
        }),
        activeId: id,
      };
    }
    case "new": {
      const s = newSession();
      return { sessions: [s, ...state.sessions].slice(0, 20), activeId: s.id };
    }
    case "select":
      return state.sessions.some((s) => s.id === action.id) ? { ...state, activeId: action.id } : state;
    case "delete": {
      const next = state.sessions.filter((s) => s.id !== action.id);
      return {
        sessions: next,
        activeId: state.activeId === action.id ? next[0]?.id ?? null : state.activeId,
      };
    }
    case "clear":
      return { sessions: [], activeId: null };
  }
}

function newSession(title = "New chat"): ChatSession {
  const now = Date.now();
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 38 ? t.slice(0, 38) + "…" : t || "New chat";
}

/** Union local + cloud sessions by id; newer updatedAt wins. Old rows without it fall back to createdAt. */
function mergeSessions(local: ChatSession[], remote: ChatSession[]): ChatSession[] {
  const map = new Map<string, ChatSession>();
  for (const s of [...local, ...remote]) {
    const norm = { ...s, updatedAt: s.updatedAt ?? s.createdAt };
    const cur = map.get(s.id);
    if (!cur || (norm.updatedAt ?? 0) > (cur.updatedAt ?? 0)) map.set(s.id, norm);
  }
  return [...map.values()]
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .slice(0, 20);
}

interface AppState {
  profile: ParsedProfile | null;
  resumeText: string;
  health: { score: number } | null;
  fullHealth: unknown | null;
  jobs: JobMatch[];
  avgMatch: number | null;
  quiz: QuizQ[];
  verifiedCount: number;
  /** Messages of the active session (compat view). */
  chat: ChatMsg[];
  sessions: ChatSession[];
  activeId: string | null;
  hydrated: boolean;
  cloudSync: boolean;
  setResume: (text: string, profile: ParsedProfile, health: unknown) => void;
  setJobs: (jobs: JobMatch[]) => void;
  setQuiz: (q: QuizQ[]) => void;
  setVerified: (n: number) => void;
  pushChat: (m: ChatMsg) => void;
  newChatSession: () => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  clearAll: () => void;
}

const Ctx = createContext<AppState | null>(null);
const keyFor = (uid: string | null) => (uid ? `resumeai_state_${uid}` : "resumeai_state_anon");

async function postJSON(url: string, body: unknown): Promise<unknown> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await r.json().catch(() => ({}));
  } catch { return {}; }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const uid = user?.id ?? null;
  const [profile, setProfile] = useState<ParsedProfile | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [fullHealth, setFullHealth] = useState<unknown | null>(null);
  const [jobs, setJobsState] = useState<JobMatch[]>([]);
  const [quiz, setQuizState] = useState<QuizQ[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [chatState, dispatchChat] = React.useReducer(chatReducer, { sessions: [], activeId: null });
  const { sessions, activeId } = chatState;
  const [hydrated, setHydrated] = useState(false);
  const [cloudSync, setCloudSync] = useState(false);
  const profileStamp = useRef(0);
  const skipChatPush = useRef(true);

  // Load the current user's isolated slice, then merge cloud state (if signed in).
  useEffect(() => {
    if (loading) return;
    setHydrated(false);
    setCloudSync(false);
    skipChatPush.current = true;
    let cancelled = false;
    (async () => {
      let localProfile: ParsedProfile | null = null;
      let localText = "";
      let localHealth: unknown = null;
      let localJobs: JobMatch[] = [];
      let localVerified = 0;
      let localSessions: ChatSession[] = [];
      let localStamp = 0;
      try {
        const raw = localStorage.getItem(keyFor(uid));
        if (raw) {
          const s = JSON.parse(raw);
          const storedProfile = (s.profile ?? null) as ParsedProfile | null;
          if (storedProfile) storedProfile.name = cleanName(storedProfile.name || "") || "Candidate";
          localProfile = storedProfile;
          localText = s.resumeText ?? "";
          localHealth = s.fullHealth ?? null;
          localJobs = s.jobs ?? [];
          localVerified = s.verifiedCount ?? 0;
          localStamp = Number(s.savedAt) || 0;
          const stored: ChatSession[] = Array.isArray(s.sessions) ? s.sessions : [];
          if (!stored.length && Array.isArray(s.chat) && s.chat.length) {
            const mig = newSession(titleFrom((s.chat[0] as ChatMsg)?.text ?? "Imported chat"));
            mig.messages = s.chat as ChatMsg[];
            localSessions = [mig];
          } else {
            localSessions = stored.map((x) => ({ ...x, updatedAt: x.updatedAt ?? x.createdAt }));
          }
        }
      } catch { /* corrupted slice → start clean */ }
      if (cancelled) return;
      setProfile(localProfile);
      setResumeText(localText);
      setFullHealth(localHealth);
      setJobsState(localJobs);
      setVerifiedCount(localVerified);
      profileStamp.current = localStamp;
      dispatchChat({ type: "load", sessions: localSessions });
      setQuizState([]);

      // Cloud merge (signed in only): last-write-wins for profile, union for chats.
      if (uid) {
        try {
          const [p, c] = await Promise.all([
            fetch("/api/profile").then((r) => r.json()).catch(() => ({ row: null })),
            fetch("/api/chats").then((r) => r.json()).catch(() => ({ sessions: [] })),
          ]);
          if (cancelled) return;
          const row = (p as { row: null | { resume_text: string; parsed: ParsedProfile; health: unknown; updated_at: string } }).row;
          if (row?.parsed) {
            const cloudTime = Date.parse(row.updated_at);
            if (!localProfile || (cloudTime && cloudTime > localStamp)) {
              const parsed = row.parsed as ParsedProfile;
              if (parsed) parsed.name = cleanName(parsed.name || "") || "Candidate";
              setProfile(parsed);
              setResumeText(row.resume_text ?? "");
              setFullHealth(row.health ?? null);
              profileStamp.current = cloudTime || Date.now();
            } else if (localProfile) {
              // Local is newer (offline edits) — push it up.
              void postJSON("/api/profile", { profile: localProfile, resumeText: localText, health: localHealth });
              profileStamp.current = Date.now();
            }
          } else if (localProfile) {
            void postJSON("/api/profile", { profile: localProfile, resumeText: localText, health: localHealth });
            profileStamp.current = Date.now();
          }
          const remote = ((c as { sessions: ChatSession[] }).sessions ?? []).map((x) => ({ ...x, updatedAt: x.updatedAt ?? x.createdAt }));
          if (remote.length || localSessions.length) {
            dispatchChat({ type: "load", sessions: mergeSessions(localSessions, remote) });
          }
          setCloudSync(true);
        } catch {
          setCloudSync(false);
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [uid, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to the current user's isolated slice only (+ profile timestamp).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        keyFor(uid),
        JSON.stringify({ profile, resumeText, fullHealth, jobs, verifiedCount, sessions, savedAt: profileStamp.current })
      );
    } catch {}
  }, [profile, resumeText, fullHealth, jobs, verifiedCount, sessions, hydrated, uid]);

  // Push chats to cloud (debounced, signed in only).
  useEffect(() => {
    if (!hydrated || !uid) return;
    if (skipChatPush.current) { skipChatPush.current = false; return; }
    const t = setTimeout(() => {
      void postJSON("/api/chats", { sessions }).then(() => setCloudSync(true)).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [sessions, hydrated, uid]);

  const chat = useMemo(
    () => sessions.find((s) => s.id === activeId)?.messages ?? [],
    [sessions, activeId]
  );

  const value = useMemo<AppState>(() => ({
    profile, resumeText, jobs, quiz, verifiedCount, chat, sessions, activeId, fullHealth, hydrated, cloudSync,
    health: fullHealth as { score: number } | null,
    avgMatch: jobs.length ? Math.round(jobs.reduce((a, j) => a + j.matchScore, 0) / jobs.length) : null,
    setResume: (text, p, h) => {
      setResumeText(text); setProfile(p); setFullHealth(h);
      profileStamp.current = Date.now();
      if (uid) void postJSON("/api/profile", { profile: p, resumeText: text, health: h }).then(() => setCloudSync(true)).catch(() => {});
    },
    setJobs: (j) => setJobsState(j),
    setQuiz: (q) => setQuizState(q),
    setVerified: setVerifiedCount,
    pushChat: (m) => dispatchChat({ type: "push", msg: m }),
    newChatSession: () => dispatchChat({ type: "new" }),
    selectSession: (id) => dispatchChat({ type: "select", id }),
    deleteSession: (id) => {
      dispatchChat({ type: "delete", id });
      if (uid) fetch(`/api/chats?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    },
    clearAll: () => {
      setProfile(null); setResumeText(""); setFullHealth(null);
      setJobsState([]); setQuizState([]); setVerifiedCount(0);
      profileStamp.current = 0;
      dispatchChat({ type: "clear" });
      try { localStorage.removeItem(keyFor(uid)); } catch {}
      if (uid) {
        fetch("/api/profile", { method: "DELETE" }).catch(() => {});
        fetch("/api/chats?all=1", { method: "DELETE" }).catch(() => {});
      }
    },
  }), [profile, resumeText, jobs, quiz, verifiedCount, chat, sessions, activeId, fullHealth, hydrated, cloudSync, uid]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
