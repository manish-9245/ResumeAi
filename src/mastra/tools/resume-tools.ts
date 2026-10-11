import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { parsedResumeSchema } from "@/mastra/schemas";

const SKILL_WEIGHTS: Record<string, number> = {
  react: 9,
  "next.js": 9,
  nextjs: 9,
  typescript: 8,
  javascript: 7,
  python: 7,
  node: 7,
  "node.js": 7,
  sql: 8,
  postgres: 8,
  aws: 8,
  docker: 7,
  kubernetes: 8,
  java: 7,
};

export const computeResumeHealthTool = createTool({
  id: "compute-resume-health",
  description: "Calculate deterministic resume health score from parsed profile data",
  inputSchema: z.object({
    parsedProfile: parsedResumeSchema,
  }),
  outputSchema: z.object({
    parsedProfile: parsedResumeSchema,
    resumeHealthScore: z.number().min(0).max(100),
  }),
  execute: async ({ parsedProfile }) => {
    const normalizedSkills = parsedProfile.skills.map((skill) => skill.name.trim().toLowerCase());
    const uniqueSkills = new Set(normalizedSkills);

    const weightedSkillScore = [...uniqueSkills].reduce((total, skill) => total + (SKILL_WEIGHTS[skill] ?? 5), 0);
    const maxSkillScore = Math.max(40, parsedProfile.skills.length * 9);
    const skillHealth = Math.min(40, Math.round((weightedSkillScore / maxSkillScore) * 40));

    const experienceDepth = Math.min(25, parsedProfile.experience.length * 6 + Math.min(parsedProfile.yearsExperience, 7));
    const educationDepth = Math.min(10, parsedProfile.education.length * 5);
    const projectsDepth = Math.min(15, parsedProfile.projects.length * 5);
    const certificationsDepth = Math.min(10, parsedProfile.certifications.length * 4);

    const resumeHealthScore = Math.max(
      0,
      Math.min(100, skillHealth + experienceDepth + educationDepth + projectsDepth + certificationsDepth),
    );

    return { parsedProfile, resumeHealthScore };
  },
});

export const evaluateQuizSubmissionTool = createTool({
  id: "evaluate-quiz-submission",
  description: "Score quiz answers against expected responses",
  inputSchema: z.object({
    answers: z.array(
      z.object({
        questionId: z.string().uuid(),
        skill: z.string(),
        type: z.enum(["mcq", "short_answer"]),
        correctAnswer: z.string(),
        userAnswer: z.string(),
      }),
    ),
  }),
  outputSchema: z.object({
    scorePercentage: z.number().min(0).max(100),
    correctAnswers: z.number().int().min(0),
    totalQuestions: z.number().int().min(0),
    verifiedSkills: z.array(z.string()),
    needsPracticeSkills: z.array(z.string()),
    detailedResults: z.array(
      z.object({
        questionId: z.string().uuid(),
        isCorrect: z.boolean(),
      }),
    ),
  }),
  execute: async ({ answers }) => {
    let correctAnswers = 0;
    const skillResults = new Map<string, { correct: number; total: number }>();

    const detailedResults = answers.map((answer) => {
      const cleanUser = answer.userAnswer.trim().toLowerCase();
      const cleanExpected = answer.correctAnswer.trim().toLowerCase();

      const isCorrect =
        answer.type === "mcq"
          ? cleanUser === cleanExpected
          : cleanUser.includes(cleanExpected) || cleanExpected.includes(cleanUser);

      if (isCorrect) {
        correctAnswers += 1;
      }

      const current = skillResults.get(answer.skill) ?? { correct: 0, total: 0 };
      skillResults.set(answer.skill, {
        correct: current.correct + (isCorrect ? 1 : 0),
        total: current.total + 1,
      });

      return {
        questionId: answer.questionId,
        isCorrect,
      };
    });

    const totalQuestions = answers.length;
    const scorePercentage = totalQuestions === 0 ? 0 : Math.round((correctAnswers / totalQuestions) * 100);

    const verifiedSkills: string[] = [];
    const needsPracticeSkills: string[] = [];

    for (const [skill, result] of skillResults) {
      if (result.correct / result.total >= 0.6) {
        verifiedSkills.push(skill);
      } else {
        needsPracticeSkills.push(skill);
      }
    }

    return {
      scorePercentage,
      correctAnswers,
      totalQuestions,
      verifiedSkills,
      needsPracticeSkills,
      detailedResults,
    };
  },
});
