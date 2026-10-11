import { mastra } from "@/mastra";
import {
  jobMatchSchema,
  parsedResumeSchema,
  quizSetSchema,
  resumeImprovementSchema,
  roadmapSchema,
  skillSimulationSchema,
  type JobMatch,
  type LearningRoadmap,
  type ParsedResume,
  type QuizSet,
  type ResumeImprovement,
  type SkillSimulation,
} from "@/mastra/schemas";

export async function parseResumeWithMastra(resumeText: string): Promise<ParsedResume> {
  const prompt = `
Extract a structured resume profile from the text below.
Use only explicit evidence from the resume. If data is missing, keep arrays empty and summary concise.

Resume Text:
${resumeText}
`;

  const response = await mastra.getAgentById("resume-parser-agent").generate(prompt, {
    structuredOutput: { schema: parsedResumeSchema },
  });

  return parsedResumeSchema.parse(response.object);
}

export async function analyzeJobMatchWithMastra(profile: ParsedResume, jobDescription: string): Promise<JobMatch> {
  const prompt = `
Candidate Profile (JSON):
${JSON.stringify(profile)}

Target Job Description:
${jobDescription}

Evaluate fit. Produce objective matchingSkills, partialSkills, missingSkills with priority and an overallScore 0-100.
`;

  const response = await mastra.getAgentById("job-match-agent").generate(prompt, {
    structuredOutput: { schema: jobMatchSchema },
  });

  return jobMatchSchema.parse(response.object);
}

export async function createRoadmapWithMastra(match: JobMatch, profile: ParsedResume): Promise<LearningRoadmap> {
  const prompt = `
Candidate Profile (JSON):
${JSON.stringify(profile)}

Skill Gaps (JSON):
${JSON.stringify(match.missingSkills)}

Build a practical roadmap with weekly milestones and measurable outcomes.
`;

  const response = await mastra.getAgentById("roadmap-agent").generate(prompt, {
    structuredOutput: { schema: roadmapSchema },
  });

  return roadmapSchema.parse(response.object);
}

export async function generateResumeImprovementsWithMastra(
  profile: ParsedResume,
  match: JobMatch,
): Promise<ResumeImprovement> {
  const prompt = `
Candidate Profile (JSON):
${JSON.stringify(profile)}

Job Match Analysis (JSON):
${JSON.stringify(match)}

Suggest wording and presentation improvements that remain fully factual.
`;

  const response = await mastra.getAgentById("resume-improvement-agent").generate(prompt, {
    structuredOutput: { schema: resumeImprovementSchema },
  });

  return resumeImprovementSchema.parse(response.object);
}

export async function simulateSkillImpactWithMastra(
  existingMatch: JobMatch,
  profile: ParsedResume,
  learnedSkill: string,
): Promise<SkillSimulation> {
  const prompt = `
Current Match (JSON):
${JSON.stringify(existingMatch)}

Candidate Profile (JSON):
${JSON.stringify(profile)}

Simulate if the candidate learns this skill: ${learnedSkill}
Return only simulation output, clearly labeled as hypothetical.
`;

  const response = await mastra.getAgentById("job-match-agent").generate(prompt, {
    structuredOutput: { schema: skillSimulationSchema },
  });

  return skillSimulationSchema.parse(response.object);
}

export async function generateQuizWithMastra(profile: ParsedResume): Promise<QuizSet> {
  const prompt = `
Candidate Skills and Evidence (JSON):
${JSON.stringify(profile.skills)}

Generate 8 practical quiz questions based strictly on these claimed skills.
Use a mix of MCQ and short answer.
For MCQ, include exactly 4 options.
`;

  const response = await mastra.getAgentById("quiz-generator-agent").generate(prompt, {
    structuredOutput: { schema: quizSetSchema },
  });

  return quizSetSchema.parse(response.object);
}
