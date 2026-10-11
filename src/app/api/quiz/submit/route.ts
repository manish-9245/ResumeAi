import { z } from "zod";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getQuizSessionWithQuestions, saveQuizResult } from "@/lib/data-access";
import { evaluateQuizSubmission } from "@/mastra/tools/resume-tools";

const inputSchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.string().min(1),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.user) return auth.errorResponse;

    const parsedInput = inputSchema.parse(await request.json());
    const quizData = await getQuizSessionWithQuestions(auth.user, parsedInput.sessionId);

    const submissionInput = parsedInput.answers.map((answer) => {
      const question = quizData.questions.find((item) => item.id === answer.questionId);
      if (!question) {
        throw new Error(`Question ${answer.questionId} not found in quiz session.`);
      }

      return {
        questionId: question.id,
        skill: question.skill,
        type: question.question_type,
        correctAnswer: question.correct_answer,
        userAnswer: answer.answer,
      } as const;
    });

    const result = evaluateQuizSubmission(submissionInput);

    await saveQuizResult(auth.user, parsedInput.sessionId, {
      scorePercentage: result.scorePercentage,
      verifiedSkills: result.verifiedSkills,
      needsPracticeSkills: result.needsPracticeSkills,
      answers: parsedInput.answers.map((answer) => {
        const detailed = result.detailedResults.find((item) => item.questionId === answer.questionId);
        return {
          questionId: answer.questionId,
          answer: answer.answer,
          isCorrect: Boolean(detailed?.isCorrect),
        };
      }),
    });

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quiz submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
