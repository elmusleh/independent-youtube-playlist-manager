// apps/web-portal/app/api/pair/verify/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, syncKey } = body;

    if (!code || !syncKey) {
      return NextResponse.json({ error: "Code and sync key required" }, { status: 400 });
    }

    // Find the pairing code
    const { data: pairing, error: findError } = await supabase
      .from("pairing_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("used", false)
      .single();

    if (findError || !pairing) {
      return NextResponse.json({ error: "Invalid or expired pairing code" }, { status: 404 });
    }

    // Check expiry
    if (new Date(pairing.expires_at) < new Date()) {
      return NextResponse.json({ error: "Pairing code expired" }, { status: 410 });
    }

    // Store the sync key for the TV to pick up
    const { error: updateError } = await supabase
      .from("pairing_codes")
      .update({
        sync_key: syncKey,
        used: true,
        paired_at: new Date().toISOString(),
      })
      .eq("code", code.toUpperCase());

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pairing verify error:", error);
    return NextResponse.json({ error: "Failed to verify pairing" }, { status: 500 });
  }
}
