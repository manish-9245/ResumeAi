import pdf from "pdf-parse";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseResumeWithMastra } from "@/mastra/service";
import { computeResumeHealthTool } from "@/mastra/tools/resume-tools";
import { saveResumeRecord } from "@/lib/data-access";

const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.user) return auth.errorResponse;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json({ error: "PDF exceeds 8MB upload limit." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const parsedPdf = await pdf(fileBuffer);
    const rawText = parsedPdf.text?.trim();

    if (!rawText || rawText.length < 80) {
      return NextResponse.json(
        { error: "Unable to extract enough text from this PDF. Please upload a text-based resume." },
        { status: 400 },
      );
    }

    const fileExt = file.name.split(".").pop() ?? "pdf";
    const storagePath = `${auth.user.id}/${crypto.randomUUID()}.${fileExt}`;

    const storageClient = createSupabaseAdminClient();
    const { error: uploadError } = await storageClient.storage.from("resumes").upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const parsedProfile = await parseResumeWithMastra(rawText);
    const healthResult = await computeResumeHealthTool.execute?.({ parsedProfile });

    if (!healthResult) {
      return NextResponse.json({ error: "Failed to score resume profile." }, { status: 500 });
    }

    const resumeId = await saveResumeRecord(auth.user, {
      fileName: file.name,
      storagePath,
      rawText,
      parsedProfile: healthResult.parsedProfile,
      resumeHealthScore: healthResult.resumeHealthScore,
    });

    return NextResponse.json({
      resumeId,
      parsedProfile: healthResult.parsedProfile,
      resumeHealthScore: healthResult.resumeHealthScore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
