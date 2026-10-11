"use client";

import { useCallback, useMemo, useState } from "react";

type ResumeItem = {
  id: string;
  file_name: string;
  resume_health_score: number;
  created_at: string;
};

type SkillGap = { skill: string; priority: string; rationale: string };

type JobMatch = {
  overallScore: number;
  summary: string;
  matchingSkills: string[];
  missingSkills: SkillGap[];
};

type Roadmap = {
  roadmapTitle: string;
  milestones: Array<{ week: number; goal: string }>;
};

type ResumeImprovement = {
  strengths: string[];
  wordingImprovements: Array<{ section: string; improvedWording: string }>;
};

type QuizQuestion = {
  id: string;
  skill: string;
  type: "mcq" | "short_answer";
  question: string;
  options: string[];
};

type QuizResult = {
  scorePercentage: number;
  correctAnswers: number;
  totalQuestions: number;
  verifiedSkills: string[];
  needsPracticeSkills: string[];
};

type SkillSimulation = {
  simulatedOverallScore: number;
  delta: number;
  note: string;
};

type DashboardPayload = {
  scores: { avgResumeHealth: number; avgMatchScore: number; avgQuizScore: number };
  verifiedSkills: string[];
  nextSkillGaps: SkillGap[];
};

export function DashboardClient({
  initialResumes,
  initialDashboard,
}: {
  initialResumes: ResumeItem[];
  initialDashboard: DashboardPayload;
}) {
  const [resumes, setResumes] = useState<ResumeItem[]>(initialResumes);
  const [selectedResumeId, setSelectedResumeId] = useState<string>(initialResumes[0]?.id ?? "");
  const [jobDescription, setJobDescription] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [analysis, setAnalysis] = useState<JobMatch | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [improvement, setImprovement] = useState<ResumeImprovement | null>(null);
  const [simulationSkill, setSimulationSkill] = useState("");
  const [simulation, setSimulation] = useState<SkillSimulation | null>(null);
  const [quizSessionId, setQuizSessionId] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload>(initialDashboard);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAnalysis = Boolean(analysisId && analysis);

  const selectedResume = useMemo(() => resumes.find((resume) => resume.id === selectedResumeId) ?? null, [resumes, selectedResumeId]);

  const refreshCoreData = useCallback(async () => {
    setError(null);
    const [resumesRes, dashboardRes] = await Promise.all([fetch("/api/resumes"), fetch("/api/dashboard")]);

    const resumesJson = (await resumesRes.json()) as { resumes?: ResumeItem[]; error?: string };
    const dashboardJson = (await dashboardRes.json()) as DashboardPayload & { error?: string };

    if (!resumesRes.ok) {
      setError(resumesJson.error ?? "Unable to load resumes");
      return;
    }

    if (!dashboardRes.ok) {
      setError(dashboardJson.error ?? "Unable to load dashboard");
      return;
    }

    const nextResumes = resumesJson.resumes ?? [];
    setResumes(nextResumes);
    setDashboard(dashboardJson);

    if (!nextResumes.some((resume) => resume.id === selectedResumeId)) {
      setSelectedResumeId(nextResumes[0]?.id ?? "");
    }
  }, [selectedResumeId]);

  async function handleUpload(formData: FormData) {
    setBusy("upload");
    setError(null);

    const response = await fetch("/api/resume/upload", {
      method: "POST",
      body: formData,
    });

    const json = (await response.json()) as { resumeId?: string; error?: string };
    if (!response.ok || !json.resumeId) {
      setError(json.error ?? "Upload failed");
      setBusy(null);
      return;
    }

    setSelectedResumeId(json.resumeId);
    await refreshCoreData();
    setBusy(null);
  }

  async function runJobMatch() {
    if (!selectedResumeId) {
      setError("Upload or select a resume first.");
      return;
    }

    setBusy("match");
    setError(null);

    const response = await fetch("/api/job-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeId: selectedResumeId,
        jobDescription,
      }),
    });

    const json = (await response.json()) as { analysisId?: string; analysis?: JobMatch; error?: string };
    if (!response.ok || !json.analysisId || !json.analysis) {
      setError(json.error ?? "Match analysis failed");
      setBusy(null);
      return;
    }

    setAnalysisId(json.analysisId);
    setAnalysis(json.analysis);
    await refreshCoreData();
    setBusy(null);
  }

  async function generateRoadmap() {
    if (!analysisId || !selectedResumeId) return;

    setBusy("roadmap");
    setError(null);

    const response = await fetch("/api/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId, resumeId: selectedResumeId }),
    });

    const json = (await response.json()) as { roadmap?: Roadmap; error?: string };
    if (!response.ok || !json.roadmap) {
      setError(json.error ?? "Roadmap generation failed");
      setBusy(null);
      return;
    }

    setRoadmap(json.roadmap);
    setBusy(null);
  }

  async function runSimulation() {
    if (!analysisId || !selectedResumeId || simulationSkill.length < 2) return;

    setBusy("simulation");
    setError(null);

    const response = await fetch("/api/simulate-skill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisId,
        resumeId: selectedResumeId,
        skill: simulationSkill,
      }),
    });

    const json = (await response.json()) as { simulation?: SkillSimulation; error?: string };
    if (!response.ok || !json.simulation) {
      setError(json.error ?? "Simulation failed");
      setBusy(null);
      return;
    }

    setSimulation(json.simulation);
    setBusy(null);
  }

  async function generateImprovements() {
    if (!analysisId || !selectedResumeId) return;

    setBusy("improvement");
    setError(null);

    const response = await fetch("/api/improve-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId, resumeId: selectedResumeId }),
    });

    const json = (await response.json()) as { improvement?: ResumeImprovement; error?: string };
    if (!response.ok || !json.improvement) {
      setError(json.error ?? "Improvement generation failed");
      setBusy(null);
      return;
    }

    setImprovement(json.improvement);
    setBusy(null);
  }

  async function generateQuiz() {
    if (!selectedResumeId) return;

    setBusy("quiz-generate");
    setError(null);

    const response = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: selectedResumeId }),
    });

    const json = (await response.json()) as {
      sessionId?: string;
      questions?: QuizQuestion[];
      error?: string;
    };

    if (!response.ok || !json.sessionId || !json.questions) {
      setError(json.error ?? "Quiz generation failed");
      setBusy(null);
      return;
    }

    setQuizSessionId(json.sessionId);
    setQuizQuestions(json.questions);
    setQuizAnswers({});
    setQuizResult(null);
    setBusy(null);
  }

  async function submitQuiz() {
    if (!quizSessionId || quizQuestions.length === 0) return;

    const answers = quizQuestions.map((question) => ({
      questionId: question.id,
      answer: quizAnswers[question.id] ?? "",
    }));

    if (answers.some((answer) => answer.answer.trim().length === 0)) {
      setError("Answer every quiz question before submitting.");
      return;
    }

    setBusy("quiz-submit");
    setError(null);

    const response = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: quizSessionId, answers }),
    });

    const json = (await response.json()) as { result?: QuizResult; error?: string };
    if (!response.ok || !json.result) {
      setError(json.error ?? "Quiz submission failed");
      setBusy(null);
      return;
    }

    setQuizResult(json.result);
    await refreshCoreData();
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Career Readiness Dashboard</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Resume Health" value={`${dashboard?.scores?.avgResumeHealth ?? 0}/100`} />
          <Metric title="Avg Match Score" value={`${dashboard?.scores?.avgMatchScore ?? 0}/100`} />
          <Metric title="Avg Quiz Score" value={`${dashboard?.scores?.avgQuizScore ?? 0}/100`} />
          <Metric title="Verified Skills" value={`${dashboard?.verifiedSkills?.length ?? 0}`} />
        </div>
        <p className="mt-4 text-sm text-zinc-600">
          Recommended next gaps: {(dashboard?.nextSkillGaps ?? []).map((gap) => gap.skill).join(", ") || "No gaps yet"}
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">1) Resume Upload + Parsing</h2>
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row"
          action={async (formData) => {
            await handleUpload(formData);
          }}
        >
          <input name="file" type="file" accept="application/pdf" className="w-full rounded-lg border border-zinc-300 p-2 text-sm" />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={busy === "upload"}
          >
            {busy === "upload" ? "Uploading..." : "Upload Resume"}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-sm text-zinc-700">
          <label className="font-medium">Select Active Resume</label>
          <select
            className="w-full rounded-lg border border-zinc-300 p-2"
            value={selectedResumeId}
            onChange={(event) => setSelectedResumeId(event.target.value)}
          >
            <option value="">Choose a resume</option>
            {resumes.map((resume) => (
              <option value={resume.id} key={resume.id}>
                {resume.file_name} — health {resume.resume_health_score}/100
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">2) Job Match + Skill Gap Analysis</h2>
        <textarea
          className="mt-3 min-h-36 w-full rounded-lg border border-zinc-300 p-3 text-sm"
          placeholder="Paste target job description"
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
        />
        <button
          type="button"
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={busy === "match" || !selectedResumeId || jobDescription.length < 80}
          onClick={runJobMatch}
        >
          {busy === "match" ? "Analyzing..." : "Run Match Analysis"}
        </button>

        {analysis ? (
          <div className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <p>
              <span className="font-semibold">Match Score:</span> {analysis.overallScore}/100
            </p>
            <p>{analysis.summary}</p>
            <p>
              <span className="font-semibold">Matching:</span> {analysis.matchingSkills.join(", ") || "-"}
            </p>
            <p>
              <span className="font-semibold">Missing:</span> {analysis.missingSkills.map((item) => `${item.skill} (${item.priority})`).join(", ") || "-"}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">3) Learning Roadmap + What-If Simulator</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!hasAnalysis || busy === "roadmap"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={generateRoadmap}
          >
            {busy === "roadmap" ? "Generating roadmap..." : "Generate Roadmap"}
          </button>
          <input
            className="min-w-56 flex-1 rounded-lg border border-zinc-300 p-2 text-sm"
            placeholder="Skill to simulate"
            value={simulationSkill}
            onChange={(event) => setSimulationSkill(event.target.value)}
          />
          <button
            type="button"
            disabled={!hasAnalysis || simulationSkill.length < 2 || busy === "simulation"}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-60"
            onClick={runSimulation}
          >
            {busy === "simulation" ? "Simulating..." : "What If I Learn This?"}
          </button>
        </div>

        {roadmap ? (
          <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <p className="font-semibold">{roadmap.roadmapTitle}</p>
            <ul className="list-inside list-disc space-y-1">
              {roadmap.milestones.map((milestone) => (
                <li key={`${milestone.week}-${milestone.goal}`}>
                  Week {milestone.week}: {milestone.goal}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {simulation ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Simulation (Hypothetical)</p>
            <p>
              Simulated score: {simulation.simulatedOverallScore}/100 ({simulation.delta >= 0 ? "+" : ""}
              {simulation.delta})
            </p>
            <p className="mt-1">{simulation.note}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">4) AI Resume Improvement Assistant</h2>
        <button
          type="button"
          disabled={!hasAnalysis || busy === "improvement"}
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={generateImprovements}
        >
          {busy === "improvement" ? "Generating improvements..." : "Generate Improvements"}
        </button>

        {improvement ? (
          <div className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <p>
              <span className="font-semibold">Strengths:</span> {improvement.strengths.join(", ")}
            </p>
            <ul className="list-inside list-disc space-y-1">
              {improvement.wordingImprovements.map((item, index) => (
                <li key={index}>
                  [{item.section}] {item.improvedWording}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">5) Skill Verification Quiz</h2>
        <button
          type="button"
          disabled={!selectedResume || busy === "quiz-generate"}
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={generateQuiz}
        >
          {busy === "quiz-generate" ? "Generating quiz..." : "Generate Quiz"}
        </button>

        {quizQuestions.length > 0 ? (
          <div className="mt-4 space-y-4">
            {quizQuestions.map((question, index) => (
              <div key={question.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                <p className="font-medium">
                  Q{index + 1}. ({question.skill}) {question.question}
                </p>
                {question.type === "mcq" ? (
                  <div className="mt-2 space-y-1">
                    {question.options.map((option) => (
                      <label key={option} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={quizAnswers[question.id] === option}
                          onChange={(event) =>
                            setQuizAnswers((prev) => ({
                              ...prev,
                              [question.id]: event.target.value,
                            }))
                          }
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="mt-2 min-h-20 w-full rounded-lg border border-zinc-300 p-2"
                    value={quizAnswers[question.id] ?? ""}
                    onChange={(event) =>
                      setQuizAnswers((prev) => ({
                        ...prev,
                        [question.id]: event.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}

            <button
              type="button"
              disabled={busy === "quiz-submit"}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={submitQuiz}
            >
              {busy === "quiz-submit" ? "Submitting..." : "Submit Quiz"}
            </button>
          </div>
        ) : null}

        {quizResult ? (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <p>
              <span className="font-semibold">Score:</span> {quizResult.scorePercentage}% ({quizResult.correctAnswers}/
              {quizResult.totalQuestions})
            </p>
            <p>
              <span className="font-semibold">Verified skills:</span> {quizResult.verifiedSkills.join(", ") || "None"}
            </p>
            <p>
              <span className="font-semibold">Needs practice:</span> {quizResult.needsPracticeSkills.join(", ") || "None"}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
