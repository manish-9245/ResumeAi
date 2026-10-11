import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/data-access";

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.user) return auth.errorResponse;

    const dashboard = await getDashboardData(auth.user);
    return NextResponse.json(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
