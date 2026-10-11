import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthControls } from "@/components/resume-ai/auth-controls";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col p-6 sm:p-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">ResumeAI</h1>
          <p className="mt-1 text-zinc-600">Production-ready resume intelligence platform with Next.js, Supabase, and Mastra.</p>
        </div>
        <AuthControls email={user?.email} />
      </header>

      <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold">Everything in one workflow</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-zinc-700">
          <li>Upload PDF resumes and parse structured candidate profiles</li>
          <li>Run job match + skill gap prioritization</li>
          <li>Generate personalized learning roadmaps and run what-if simulations</li>
          <li>Get grounded resume wording improvements</li>
          <li>Verify claimed skills with adaptive quizzes</li>
        </ul>

        <div className="mt-6">
          <Link href={user ? "/dashboard" : "/login"} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
            {user ? "Open Dashboard" : "Sign in to Start"}
          </Link>
        </div>
      </section>
    </main>
  );
}
