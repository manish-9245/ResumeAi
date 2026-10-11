import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getJobAnalysisForUser, getResumeForUser, saveSimulation } from "@/lib/data-access";
import { simulateSkillImpactWithMastra } from "@/mastra/service";

const inputSchema = z.object({
  analysisId: z.string().uuid(),
  resumeId: z.string().uuid(),
  skill: z.string().min(2),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.user) return auth.errorResponse;

    const parsedInput = inputSchema.parse(await request.json());

    const [analysis, resume] = await Promise.all([
      getJobAnalysisForUser(auth.user, parsedInput.analysisId),
      getResumeForUser(auth.user, parsedInput.resumeId),
    ]);

    const simulation = await simulateSkillImpactWithMastra(
      {
        overallScore: analysis.overall_score,
        summary: analysis.summary,
        matchingSkills: analysis.matching_skills,
        partialSkills: analysis.partial_skills,
        missingSkills: analysis.missing_skills,
        suggestedResumeFocus: analysis.suggested_resume_focus,
      },
      resume.parsed_profile,
      parsedInput.skill,
    );

    await saveSimulation(auth.user, parsedInput.analysisId, parsedInput.skill, simulation);

    return NextResponse.json({ simulation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
