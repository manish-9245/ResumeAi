import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { resumeParserAgent } from "@/mastra/agents/resume-ai-agents";
import { computeResumeHealthTool } from "@/mastra/tools/resume-tools";
import { parsedResumeSchema } from "@/mastra/schemas";

const extractResumeStep = createStep(resumeParserAgent, {
  structuredOutput: {
    schema: parsedResumeSchema,
  },
});

const scoreResumeStep = createStep(computeResumeHealthTool);

export const resumeIngestionWorkflow = createWorkflow({
  id: "resume-ingestion-workflow",
  inputSchema: z.object({
    prompt: z.string().min(1),
  }),
  outputSchema: z.object({
    parsedProfile: parsedResumeSchema,
    resumeHealthScore: z.number().min(0).max(100),
  }),
})
  .then(extractResumeStep)
  .map(async ({ inputData }) => ({
    parsedProfile: inputData,
  }))
  .then(scoreResumeStep)
  .commit();
