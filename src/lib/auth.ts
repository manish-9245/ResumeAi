import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, supabase, errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, supabase, errorResponse: null };
}
