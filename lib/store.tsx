"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChatMsg, JobMatch, ParsedProfile, QuizQ } from "./types";
import { useAuth } from "./auth";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
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
          return { ...s, title, messages: [...s.messages, msg] };
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
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    createdAt: Date.now(),
    messages: [],
  };
}

function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 38 ? t.slice(0, 38) + "…" : t || "New chat";
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<ParsedProfile | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [fullHealth, setFullHealth] = useState<unknown | null>(null);
  const [jobs, setJobsState] = useState<JobMatch[]>([]);
  const [quiz, setQuizState] = useState<QuizQ[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [chatState, dispatchChat] = React.useReducer(chatReducer, { sessions: [], activeId: null });
  const { sessions, activeId } = chatState;
  const [hydrated, setHydrated] = useState(false);

  // Load the current user's isolated slice whenever the user changes.
  useEffect(() => {
    if (loading) return;
    setHydrated(false);
    try {
      const raw = localStorage.getItem(keyFor(user?.id ?? null));
      if (raw) {
        const s = JSON.parse(raw);
        setProfile(s.profile ?? null);
        setResumeText(s.resumeText ?? "");
        setFullHealth(s.fullHealth ?? null);
        setJobsState(s.jobs ?? []);
        setVerifiedCount(s.verifiedCount ?? 0);
        // Migrate legacy single-thread chat into a session.
        const stored: ChatSession[] = Array.isArray(s.sessions) ? s.sessions : [];
        if (!stored.length && Array.isArray(s.chat) && s.chat.length) {
          const mig = newSession(titleFrom((s.chat[0] as ChatMsg)?.text ?? "Imported chat"));
          mig.messages = s.chat as ChatMsg[];
          mig.createdAt = Date.now();
          dispatchChat({ type: "load", sessions: [mig] });
        } else {
          dispatchChat({ type: "load", sessions: stored });
        }
      } else {
        setProfile(null); setResumeText(""); setFullHealth(null);
        setJobsState([]); setVerifiedCount(0);
        dispatchChat({ type: "clear" });
      }
    } catch {
      setProfile(null); setResumeText(""); setFullHealth(null);
      setJobsState([]); setVerifiedCount(0);
      dispatchChat({ type: "clear" });
    }
    setQuizState([]);
    setHydrated(true);
  }, [user?.id, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to the current user's isolated slice only.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        keyFor(user?.id ?? null),
        JSON.stringify({ profile, resumeText, fullHealth, jobs, verifiedCount, sessions })
      );
    } catch {}
  }, [profile, resumeText, fullHealth, jobs, verifiedCount, sessions, hydrated, user?.id]);

  const chat = useMemo(
    () => sessions.find((s) => s.id === activeId)?.messages ?? [],
    [sessions, activeId]
  );

  const value = useMemo<AppState>(() => ({
    profile, resumeText, jobs, quiz, verifiedCount, chat, sessions, activeId, fullHealth, hydrated,
    health: fullHealth as { score: number } | null,
    avgMatch: jobs.length ? Math.round(jobs.reduce((a, j) => a + j.matchScore, 0) / jobs.length) : null,
    setResume: (text, p, h) => { setResumeText(text); setProfile(p); setFullHealth(h); },
    setJobs: (j) => setJobsState(j),
    setQuiz: (q) => setQuizState(q),
    setVerified: setVerifiedCount,
    pushChat: (m) => dispatchChat({ type: "push", msg: m }),
    newChatSession: () => dispatchChat({ type: "new" }),
    selectSession: (id) => dispatchChat({ type: "select", id }),
    deleteSession: (id) => dispatchChat({ type: "delete", id }),
    clearAll: () => {
      setProfile(null); setResumeText(""); setFullHealth(null);
      setJobsState([]); setQuizState([]); setVerifiedCount(0);
      dispatchChat({ type: "clear" });
      try { localStorage.removeItem(keyFor(user?.id ?? null)); } catch {}
    },
  }), [profile, resumeText, jobs, quiz, verifiedCount, chat, sessions, activeId, fullHealth, hydrated, user?.id]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
