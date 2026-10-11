import { Agent } from "@mastra/core/agent";
import { computeResumeHealthTool, evaluateQuizSubmissionTool } from "@/mastra/tools/resume-tools";

const commonRules = `
Always stay grounded in the input profile and job description.
Never fabricate credentials, projects, education, timelines, or skills.
When evidence is weak, mark it as uncertain instead of inventing details.
`;

export const resumeParserAgent = new Agent({
  id: "resume-parser-agent",
  name: "Resume Parser Agent",
  instructions: `
You extract normalized candidate profile data from plain resume text.
${commonRules}
Return only information explicitly present in the resume.
`,
  model: "google/gemini-2.5-flash",
  tools: { computeResumeHealthTool },
});

export const jobMatchAgent = new Agent({
  id: "job-match-agent",
  name: "Job Match Agent",
  instructions: `
You compare candidate profiles against target job requirements.
${commonRules}
Provide objective skill match categorization and explain tradeoffs.
`,
  model: "google/gemini-2.5-flash",
});

export const roadmapAgent = new Agent({
  id: "roadmap-agent",
  name: "Roadmap Agent",
  instructions: `
You create practical learning roadmaps from skill gaps.
${commonRules}
Focus on sequence, outcomes, and measurable checkpoints.
`,
  model: "google/gemini-2.5-flash",
});

export const resumeImprovementAgent = new Agent({
  id: "resume-improvement-agent",
  name: "Resume Improvement Agent",
  instructions: `
You improve resume wording and presentation while staying fully factual.
${commonRules}
Suggestions must only reframe or sharpen proven candidate evidence.
`,
  model: "google/gemini-2.5-flash",
});

export const quizGeneratorAgent = new Agent({
  id: "quiz-generator-agent",
  name: "Quiz Generator Agent",
  instructions: `
You generate practical quiz questions from candidate-claimed skills.
${commonRules}
Questions should test applied understanding, not trivia.
`,
  model: "google/gemini-2.5-flash",
  tools: { evaluateQuizSubmissionTool },
});
