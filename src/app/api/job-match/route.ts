import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { analyzeJobMatchWithMastra } from "@/mastra/service";
import { getResumeForUser, saveJobAnalysis } from "@/lib/data-access";

const inputSchema = z.object({
  resumeId: z.string().uuid(),
  jobDescription: z.string().min(80),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.user) return auth.errorResponse;

    const parsedInput = inputSchema.parse(await request.json());
    const resume = await getResumeForUser(auth.user, parsedInput.resumeId);

    const analysis = await analyzeJobMatchWithMastra(resume.parsed_profile, parsedInput.jobDescription);
    const analysisId = await saveJobAnalysis(auth.user, parsedInput.resumeId, parsedInput.jobDescription, analysis);

    return NextResponse.json({ analysisId, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job match analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
