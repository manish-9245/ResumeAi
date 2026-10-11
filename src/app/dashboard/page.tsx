import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/resume-ai/dashboard-client";
import { AuthControls } from "@/components/resume-ai/auth-controls";
import { getDashboardData, listResumesForUser } from "@/lib/data-access";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [resumes, dashboard] = await Promise.all([listResumesForUser(user), getDashboardData(user)]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6 sm:p-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ResumeAI Dashboard</h1>
          <p className="text-sm text-zinc-600">Upload, analyze, improve, and verify resume readiness.</p>
        </div>
        <AuthControls email={user.email} />
      </header>

      <DashboardClient initialResumes={resumes} initialDashboard={dashboard} />
    </main>
  );
}
