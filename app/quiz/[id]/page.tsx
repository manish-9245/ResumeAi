import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Chip } from "@/components/shell";
import { authed, getQuizAttempt } from "@/lib/server-db";
import type { QuizQ } from "@/lib/types";
import { ArrowLeft } from "lucide-react";

export default async function QuizAttempt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authed();
  if (!auth) redirect(`/auth?next=${encodeURIComponent(`/quiz/${id}`)}`);
  const row = await getQuizAttempt(auth.userId, auth.sb, id);
  if (!row || !Array.isArray(row.questions)) notFound();

  const questions = row.questions as QuizQ[];
  const answers = (row.answers ?? {}) as Record<string, number>;
  const topics = Array.isArray(row.topics) ? (row.topics as string[]) : [];
  const score = Number(row.score ?? 0);
  const pass = score >= Math.ceil(questions.length * 0.65);

  return (
    <AppShell requireAuth title={`Quiz review — ${score}/${questions.length}`} sub={`Taken ${new Date(row.created_at as string).toLocaleString()} · topics: ${topics.join(", ") || "—"}`}>
      <div className="card min-w-0 p-4 sm:p-5" style={{ background: pass ? "#E6F7EE" : "#FFF4D6", borderColor: pass ? "#0E9F6E" : "#B45309" }}>
        <div className="font-display text-[18px] font-bold leading-snug sm:text-[20px]">{score}/{questions.length} verified {pass ? "— claims held up." : "— re-learn the misses."}</div>
      </div>
      <div className="mt-3 grid gap-2.5">
        {questions.map((item, i) => (
          <div key={item.id} className="card min-w-0 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: "#3F4A63" }}><span className="font-data">Q{i + 1}</span> <Chip tone="info">{item.skill}</Chip></div>
            <div className="font-display mt-1.5 text-[15.5px] font-bold">{item.question}</div>
            <div className="mt-2.5 grid gap-1.5">
              {item.options.map((o, k) => {
                const picked = answers[item.id] === k;
                const showRight = item.answer === k;
                const showWrong = picked && k !== item.answer;
                return (
                  <div key={k}
                    className="rounded-[10px] border px-3.5 py-2.5 text-[13.5px] font-medium"
                    style={{ borderColor: showRight ? "#0E9F6E" : showWrong ? "#DC2626" : "#E2E8F2", background: showRight ? "#E6F7EE" : showWrong ? "#FDE8E8" : "#fff" }}>
                    <span className="font-data mr-2 font-bold">{String.fromCharCode(65 + k)}</span> {o}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[12.5px] italic" style={{ color: "#3F4A63" }}>{item.explain}</div>
          </div>
        ))}
      </div>
      <Link href="/quiz" className="mt-3 inline-flex items-center gap-1.5 rounded-[12px] border px-4 py-2.5 text-[13px] font-bold" style={{ borderColor: "#E2E8F2" }}><ArrowLeft size={14} /> All quizzes</Link>
    </AppShell>
  );
}
