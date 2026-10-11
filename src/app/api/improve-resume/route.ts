import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getJobAnalysisForUser, getResumeForUser, saveResumeImprovement } from "@/lib/data-access";
import { generateResumeImprovementsWithMastra } from "@/mastra/service";

const inputSchema = z.object({
  analysisId: z.string().uuid(),
  resumeId: z.string().uuid(),
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

    const improvement = await generateResumeImprovementsWithMastra(resume.parsed_profile, {
      overallScore: analysis.overall_score,
      summary: analysis.summary,
      matchingSkills: analysis.matching_skills,
      partialSkills: analysis.partial_skills,
      missingSkills: analysis.missing_skills,
      suggestedResumeFocus: analysis.suggested_resume_focus,
    });

    const improvementId = await saveResumeImprovement(auth.user, parsedInput.resumeId, parsedInput.analysisId, improvement);

    return NextResponse.json({ improvementId, improvement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume improvement failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
