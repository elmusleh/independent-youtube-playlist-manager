export const dynamic = "force-dynamic";
// apps/web-portal/app/api/pair/verify/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, syncKey } = body;

    if (!code || !syncKey) {
      return NextResponse.json({ error: "Code and sync key required" }, { status: 400 });
    }

    // Find the pairing code
    const sb = getSupabase(); if (!sb) return NextResponse.json({ error: "Not configured" }, { status: 503 });
    const { data: pairing, error: findError } = await sb
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
    const { error: updateError } = await sb
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
