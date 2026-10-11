import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { listResumesForUser } from "@/lib/data-access";

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.user) return auth.errorResponse;

    const resumes = await listResumesForUser(auth.user);
    return NextResponse.json({ resumes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch resumes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
