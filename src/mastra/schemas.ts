import { z } from "zod";

export const skillLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);

export const parsedResumeSchema = z.object({
  candidateName: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  yearsExperience: z.number().min(0).max(60),
  skills: z.array(
    z.object({
      name: z.string().min(1),
      level: skillLevelSchema,
      evidence: z.string().min(1),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string().min(1),
      degree: z.string().min(1),
      field: z.string().min(1),
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      highlights: z.array(z.string().min(1)),
    }),
  ),
  experience: z.array(
    z.object({
      company: z.string().min(1),
      role: z.string().min(1),
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      achievements: z.array(z.string().min(1)),
      skillsUsed: z.array(z.string().min(1)),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      impact: z.string().min(1),
      skillsUsed: z.array(z.string().min(1)),
    }),
  ),
  certifications: z.array(
    z.object({
      name: z.string().min(1),
      issuer: z.string().min(1),
      issueDate: z.string().min(1),
    }),
  ),
});

export const skillGapPrioritySchema = z.enum(["critical", "high", "medium", "low"]);

export const jobMatchSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string().min(1),
  matchingSkills: z.array(z.string().min(1)),
  partialSkills: z.array(
    z.object({
      skill: z.string().min(1),
      rationale: z.string().min(1),
    }),
  ),
  missingSkills: z.array(
    z.object({
      skill: z.string().min(1),
      rationale: z.string().min(1),
      priority: skillGapPrioritySchema,
    }),
  ),
  suggestedResumeFocus: z.array(z.string().min(1)),
});

export const roadmapSchema = z.object({
  roadmapTitle: z.string().min(1),
  milestones: z.array(
    z.object({
      week: z.number().int().min(1),
      goal: z.string().min(1),
      outcomes: z.array(z.string().min(1)),
      projects: z.array(z.string().min(1)),
      validation: z.string().min(1),
    }),
  ),
  estimatedReadinessScore: z.number().min(0).max(100),
});

export const resumeImprovementSchema = z.object({
  strengths: z.array(z.string().min(1)),
  wordingImprovements: z.array(
    z.object({
      section: z.string().min(1),
      originalTheme: z.string().min(1),
      improvedWording: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
  presentationEnhancements: z.array(z.string().min(1)),
});

export const quizQuestionSchema = z.object({
  skill: z.string().min(1),
  type: z.enum(["mcq", "short_answer"]),
  question: z.string().min(1),
  options: z.array(z.string().min(1)),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(1),
});

export const quizSetSchema = z.object({
  questions: z.array(quizQuestionSchema).min(5).max(12),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type JobMatch = z.infer<typeof jobMatchSchema>;
export type LearningRoadmap = z.infer<typeof roadmapSchema>;
export type ResumeImprovement = z.infer<typeof resumeImprovementSchema>;
export type QuizSet = z.infer<typeof quizSetSchema>;

export const skillSimulationSchema = z.object({
  simulatedOverallScore: z.number().min(0).max(100),
  delta: z.number(),
  assumptions: z.array(z.string().min(1)),
  updatedMissingSkills: z.array(
    z.object({
      skill: z.string().min(1),
      rationale: z.string().min(1),
      priority: skillGapPrioritySchema,
    }),
  ),
  note: z.string().min(1),
});

export type SkillSimulation = z.infer<typeof skillSimulationSchema>;
