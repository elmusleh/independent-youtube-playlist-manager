export const dynamic = "force-dynamic";
// apps/web-portal/app/api/pair/generate/route.ts
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
    const { deviceType } = body;

    // Generate a 6-digit pairing code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in database with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const sb = getSupabase(); if (!sb) return NextResponse.json({ error: "Not configured" }, { status: 503 });
      const { error } = await sb.from("pairing_codes").insert({
      code,
      expires_at: expiresAt,
      used: false,
      device_type: deviceType || "unknown",
    });

    if (error) throw error;

    return NextResponse.json({
      code,
      expiresAt: new Date(expiresAt).getTime(),
    });
  } catch (error) {
    console.error("Pairing generate error:", error);
    return NextResponse.json({ error: "Failed to generate pairing code" }, { status: 500 });
  }
}
