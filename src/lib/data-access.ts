import { randomUUID } from "crypto";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { JobMatch, LearningRoadmap, ParsedResume, QuizSet, ResumeImprovement, SkillSimulation } from "@/mastra/schemas";

export async function saveResumeRecord(user: User, payload: {
  fileName: string;
  storagePath: string;
  rawText: string;
  parsedProfile: ParsedResume;
  resumeHealthScore: number;
}) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("resumes")
    .insert({
      id: randomUUID(),
      user_id: user.id,
      file_name: payload.fileName,
      storage_path: payload.storagePath,
      raw_text: payload.rawText,
      parsed_profile: payload.parsedProfile,
      resume_health_score: payload.resumeHealthScore,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save resume: ${error.message}`);

  return data.id as string;
}

export async function listResumesForUser(user: User) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("resumes")
    .select("id,file_name,parsed_profile,resume_health_score,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch resumes: ${error.message}`);
  return data;
}

export async function getResumeForUser(user: User, resumeId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("resumes")
    .select("id,user_id,file_name,storage_path,raw_text,parsed_profile,resume_health_score")
    .eq("user_id", user.id)
    .eq("id", resumeId)
    .single();

  if (error) throw new Error(`Failed to fetch resume: ${error.message}`);
  return data;
}

export async function saveJobAnalysis(user: User, resumeId: string, jobDescription: string, analysis: JobMatch) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("job_analyses")
    .insert({
      id: randomUUID(),
      user_id: user.id,
      resume_id: resumeId,
      job_description: jobDescription,
      overall_score: analysis.overallScore,
      summary: analysis.summary,
      matching_skills: analysis.matchingSkills,
      partial_skills: analysis.partialSkills,
      missing_skills: analysis.missingSkills,
      suggested_resume_focus: analysis.suggestedResumeFocus,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save job analysis: ${error.message}`);
  return data.id as string;
}

export async function getJobAnalysisForUser(user: User, analysisId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("job_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .single();

  if (error) throw new Error(`Failed to fetch job analysis: ${error.message}`);
  return data;
}

export async function saveRoadmap(user: User, analysisId: string, roadmap: LearningRoadmap) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("learning_roadmaps")
    .insert({
      id: randomUUID(),
      user_id: user.id,
      analysis_id: analysisId,
      roadmap_title: roadmap.roadmapTitle,
      milestones: roadmap.milestones,
      estimated_readiness_score: roadmap.estimatedReadinessScore,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save roadmap: ${error.message}`);

  return data.id as string;
}

export async function saveSimulation(user: User, analysisId: string, skill: string, simulation: SkillSimulation) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("skill_simulations").insert({
    id: randomUUID(),
    user_id: user.id,
    analysis_id: analysisId,
    simulated_skill: skill,
    simulated_score: simulation.simulatedOverallScore,
    delta: simulation.delta,
    assumptions: simulation.assumptions,
    updated_missing_skills: simulation.updatedMissingSkills,
    note: simulation.note,
  });

  if (error) throw new Error(`Failed to save simulation: ${error.message}`);
}

export async function saveResumeImprovement(user: User, resumeId: string, analysisId: string, improvement: ResumeImprovement) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("resume_improvements")
    .insert({
      id: randomUUID(),
      user_id: user.id,
      resume_id: resumeId,
      analysis_id: analysisId,
      strengths: improvement.strengths,
      wording_improvements: improvement.wordingImprovements,
      presentation_enhancements: improvement.presentationEnhancements,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save resume improvement: ${error.message}`);

  return data.id as string;
}

export async function createQuizSession(user: User, resumeId: string, quiz: QuizSet) {
  const supabase = createSupabaseAdminClient();

  const sessionId = randomUUID();
  const questions = quiz.questions.map((question) => ({
    id: randomUUID(),
    session_id: sessionId,
    skill: question.skill,
    question_type: question.type,
    question_text: question.question,
    options: question.options,
    correct_answer: question.correctAnswer,
    explanation: question.explanation,
  }));

  const { error: sessionError } = await supabase.from("quiz_sessions").insert({
    id: sessionId,
    user_id: user.id,
    resume_id: resumeId,
    status: "generated",
  });

  if (sessionError) throw new Error(`Failed to create quiz session: ${sessionError.message}`);

  const { error: questionsError } = await supabase.from("quiz_questions").insert(questions);

  if (questionsError) throw new Error(`Failed to save quiz questions: ${questionsError.message}`);

  return {
    sessionId,
    questions: questions.map((question) => ({
      id: question.id,
      skill: question.skill,
      type: question.question_type,
      question: question.question_text,
      options: question.options,
    })),
  };
}

export async function getQuizSessionWithQuestions(user: User, sessionId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("quiz_sessions")
    .select("id,user_id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    throw new Error("Quiz session not found");
  }

  const { data: questions, error: questionsError } = await supabase
    .from("quiz_questions")
    .select("id,skill,question_type,question_text,options,correct_answer")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (questionsError) throw new Error(`Failed to fetch quiz questions: ${questionsError.message}`);

  return { session, questions };
}

export async function saveQuizResult(user: User, sessionId: string, payload: {
  scorePercentage: number;
  verifiedSkills: string[];
  needsPracticeSkills: string[];
  answers: Array<{ questionId: string; answer: string; isCorrect: boolean }>;
}) {
  const supabase = createSupabaseAdminClient();

  const answerRows = payload.answers.map((answer) => ({
    id: randomUUID(),
    session_id: sessionId,
    user_id: user.id,
    question_id: answer.questionId,
    answer_text: answer.answer,
    is_correct: answer.isCorrect,
  }));

  const { error: answersError } = await supabase.from("quiz_answers").insert(answerRows);
  if (answersError) throw new Error(`Failed to store quiz answers: ${answersError.message}`);

  const { error: updateError } = await supabase
    .from("quiz_sessions")
    .update({
      status: "completed",
      score_percentage: payload.scorePercentage,
      verified_skills: payload.verifiedSkills,
      needs_practice_skills: payload.needsPracticeSkills,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (updateError) throw new Error(`Failed to update quiz session: ${updateError.message}`);
}

export async function getDashboardData(user: User) {
  const supabase = createSupabaseAdminClient();

  const [{ data: resumes, error: resumesError }, { data: analyses, error: analysesError }, { data: quizSessions, error: quizzesError }] =
    await Promise.all([
      supabase
        .from("resumes")
        .select("id,resume_health_score,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_analyses")
        .select("id,overall_score,created_at,missing_skills")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("quiz_sessions")
        .select("id,score_percentage,verified_skills,needs_practice_skills,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  if (resumesError) throw new Error(`Failed to fetch resumes: ${resumesError.message}`);
  if (analysesError) throw new Error(`Failed to fetch analyses: ${analysesError.message}`);
  if (quizzesError) throw new Error(`Failed to fetch quiz sessions: ${quizzesError.message}`);

  const avgResumeHealth = resumes.length
    ? Math.round(resumes.reduce((sum, item) => sum + (item.resume_health_score ?? 0), 0) / resumes.length)
    : 0;

  const avgMatchScore = analyses.length
    ? Math.round(analyses.reduce((sum, item) => sum + (item.overall_score ?? 0), 0) / analyses.length)
    : 0;

  const avgQuizScore = quizSessions.length
    ? Math.round(quizSessions.reduce((sum, item) => sum + (item.score_percentage ?? 0), 0) / quizSessions.length)
    : 0;

  const verifiedSkills = Array.from(
    new Set(quizSessions.flatMap((session) => (Array.isArray(session.verified_skills) ? session.verified_skills : []))),
  );

  const nextSkillGaps = analyses
    .flatMap((analysis) => (Array.isArray(analysis.missing_skills) ? analysis.missing_skills : []))
    .slice(0, 8);

  return {
    totals: {
      resumes: resumes.length,
      analyses: analyses.length,
      quizSessions: quizSessions.length,
    },
    scores: {
      avgResumeHealth,
      avgMatchScore,
      avgQuizScore,
    },
    verifiedSkills,
    nextSkillGaps,
    latestItems: {
      resume: resumes[0] ?? null,
      analysis: analyses[0] ?? null,
      quiz: quizSessions[0] ?? null,
    },
  };
}
