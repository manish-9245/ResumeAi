import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createQuizSession, getResumeForUser } from "@/lib/data-access";
import { generateQuizWithMastra } from "@/mastra/service";

const inputSchema = z.object({
  resumeId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.user) return auth.errorResponse;

    const parsedInput = inputSchema.parse(await request.json());
    const resume = await getResumeForUser(auth.user, parsedInput.resumeId);

    const quiz = await generateQuizWithMastra(resume.parsed_profile);
    const createdQuiz = await createQuizSession(auth.user, parsedInput.resumeId, quiz);

    return NextResponse.json(createdQuiz);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quiz generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
