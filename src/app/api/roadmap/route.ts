import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createRoadmapWithMastra } from "@/mastra/service";
import { getJobAnalysisForUser, getResumeForUser, saveRoadmap } from "@/lib/data-access";

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

    const roadmap = await createRoadmapWithMastra(
      {
        overallScore: analysis.overall_score,
        summary: analysis.summary,
        matchingSkills: analysis.matching_skills,
        partialSkills: analysis.partial_skills,
        missingSkills: analysis.missing_skills,
        suggestedResumeFocus: analysis.suggested_resume_focus,
      },
      resume.parsed_profile,
    );

    const roadmapId = await saveRoadmap(auth.user, parsedInput.analysisId, roadmap);

    return NextResponse.json({ roadmapId, roadmap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Roadmap generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
