export type SkillGapPriority = "critical" | "high" | "medium" | "low";

export interface ResumeRecord {
  id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  raw_text: string;
  parsed_profile: ParsedResumeProfile;
  resume_health_score: number;
  created_at: string;
}

export interface ParsedResumeProfile {
  candidateName: string;
  title: string;
  summary: string;
  yearsExperience: number;
  skills: Array<{
    name: string;
    level: "beginner" | "intermediate" | "advanced";
    evidence: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    highlights: string[];
  }>;
  experience: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    achievements: string[];
    skillsUsed: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    impact: string;
    skillsUsed: string[];
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    issueDate: string;
  }>;
}

export interface JobMatchResult {
  overallScore: number;
  summary: string;
  matchingSkills: string[];
  partialSkills: Array<{ skill: string; rationale: string }>;
  missingSkills: Array<{ skill: string; rationale: string; priority: SkillGapPriority }>;
  suggestedResumeFocus: string[];
}

export interface LearningRoadmapResult {
  roadmapTitle: string;
  milestones: Array<{
    week: number;
    goal: string;
    outcomes: string[];
    projects: string[];
    validation: string;
  }>;
  estimatedReadinessScore: number;
}

export interface ResumeImprovementResult {
  strengths: string[];
  wordingImprovements: Array<{
    section: string;
    originalTheme: string;
    improvedWording: string;
    reason: string;
  }>;
  presentationEnhancements: string[];
}

export interface QuizQuestion {
  id: string;
  skill: string;
  type: "mcq" | "short_answer";
  question: string;
  options: string[];
}

export interface QuizResult {
  scorePercentage: number;
  correctAnswers: number;
  totalQuestions: number;
  verifiedSkills: string[];
  needsPracticeSkills: string[];
}
