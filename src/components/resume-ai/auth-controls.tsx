"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthControls({ email }: { email?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!email) {
    return (
      <Link href="/login" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-zinc-600">{email}</p>
      <button
        type="button"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700"
        onClick={handleSignOut}
      >
        Sign out
      </button>
    </div>
  );
}
