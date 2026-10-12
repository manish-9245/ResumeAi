"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sb = createClient();
        if (!sb) return;
        const client = sb as unknown as {
          auth: {
            getSession: () => Promise<{ data: { session: { user: { id: string; email?: string } } | null } }>;
            onAuthStateChange: (cb: (event: string, session: { user: { id: string; email?: string } } | null) => void) => { data: { subscription: { unsubscribe: () => void } } };
          };
        };
        const { data } = await client.auth.getSession();
        if (mounted) {
          const u = data.session?.user;
          setUser(u ? { id: u.id, email: u.email ?? "" } : null);
        }
        const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
          const u = session?.user;
          setUser(u ? { id: u.id, email: u.email ?? "" } : null);
        });
        return () => sub.subscription.unsubscribe();
      } catch {
        /* demo mode — no session */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    signUp: async (email, password) => {
      try {
        const sb = createClient();
        if (!sb) return { error: "Supabase is not configured.", needsConfirm: false };
        const client = sb as unknown as {
          auth: { signUp: (v: { email: string; password: string; options?: { emailRedirectTo?: string } }) => Promise<{ data: { session: unknown }; error: { message: string } | null }> };
        };
        // Confirmation links land on /auth/callback (code exchange), then ?next.
        const emailRedirectTo = typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=/dashboard`
          : undefined;
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo } });
        if (error) return { error: error.message, needsConfirm: false };
        return { error: null, needsConfirm: !data.session };
      } catch {
        return { error: "Sign-up failed. Try again.", needsConfirm: false };
      }
    },
    signIn: async (email, password) => {
      try {
        const sb = createClient();
        if (!sb) return { error: "Supabase is not configured." };
        const client = sb as unknown as {
          auth: { signInWithPassword: (v: { email: string; password: string }) => Promise<{ error: { message: string } | null }> };
        };
        const { error } = await client.auth.signInWithPassword({ email, password });
        return { error: error ? error.message : null };
      } catch {
        return { error: "Sign-in failed. Try again." };
      }
    },
    signOut: async () => {
      try {
        const sb = createClient();
        if (sb) await (sb as unknown as { auth: { signOut: () => Promise<unknown> } }).auth.signOut();
      } catch {}
      setUser(null);
    },
    resendConfirmation: async (email) => {
      try {
        const sb = createClient();
        if (!sb) return { error: "Supabase is not configured." };
        const client = sb as unknown as {
          auth: { resend: (v: { type: string; email: string; options?: { emailRedirectTo?: string } }) => Promise<{ error: { message: string } | null }> };
        };
        const emailRedirectTo = typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=/dashboard`
          : undefined;
        const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo } });
        return { error: error ? error.message : null };
      } catch {
        return { error: "Resend failed. Try again in a minute." };
      }
    },
  }), [user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
