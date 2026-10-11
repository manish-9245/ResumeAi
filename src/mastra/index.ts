import { Mastra } from "@mastra/core";
import {
  jobMatchAgent,
  quizGeneratorAgent,
  resumeImprovementAgent,
  resumeParserAgent,
  roadmapAgent,
} from "@/mastra/agents/resume-ai-agents";
import { resumeIngestionWorkflow } from "@/mastra/workflows/resume-workflows";
import { computeResumeHealthTool, evaluateQuizSubmissionTool } from "@/mastra/tools/resume-tools";

export const mastra = new Mastra({
  agents: {
    resumeParserAgent,
    jobMatchAgent,
    roadmapAgent,
    resumeImprovementAgent,
    quizGeneratorAgent,
  },
  workflows: {
    resumeIngestionWorkflow,
  },
  tools: {
    computeResumeHealthTool,
    evaluateQuizSubmissionTool,
  },
});
