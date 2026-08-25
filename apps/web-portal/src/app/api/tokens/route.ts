import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: "Cloud authentication is not configured." },
        { status: 503 }
      );
    }

    const supabase = createClient(await cookies());
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 100)
        : "WebExtension Client";

    // Generate secure cryptographically random token
    const randomHex = crypto.randomBytes(16).toString("hex");
    const newToken = `yph_live_${randomHex}`;

    const adminClient = getSupabaseAdminClient();
    const { data, error } = await adminClient
      .from("api_tokens")
      .insert({
        user_id: user.id,
        token: newToken,
        label,
      })
      .select("token, label, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "success", ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
