"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("Sending magic link...");

    const supabase = createSupabaseBrowserClient();

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setStatus(null);
      setError(signInError.message);
      return;
    }

    setStatus("Check your email for the secure sign-in link.");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-6">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Sign in to ResumeAI</h1>
        <p className="mt-2 text-sm text-zinc-600">Use your email. We send a magic link via Supabase Auth.</p>

        <form className="mt-6 space-y-4" onSubmit={handleLogin}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 p-3 text-sm"
          />
          <button type="submit" className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
            Send magic link
          </button>
        </form>

        {status ? <p className="mt-4 text-sm text-emerald-700">{status}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <Link href="/" className="mt-6 inline-block text-sm text-zinc-600 hover:underline">
          Back to home
        </Link>
      </section>
    </main>
  );
}
