export const dynamic = "force-dynamic";
// apps/web-portal/app/api/pair/route.ts
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
    const { action } = body;

    if (action === "generate") {
      // Generate a 6-digit pairing code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Store in database with 10-minute expiry
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const sb = getSupabase(); if (!sb) return NextResponse.json({ error: "Not configured" }, { status: 503 });
      const { error } = await sb.from("pairing_codes").insert({
        code,
        expires_at: expiresAt,
        used: false,
      });

      if (error) throw error;

      return NextResponse.json({ code, expiresAt });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Pairing generate error:", error);
    return NextResponse.json({ error: "Failed to generate pairing code" }, { status: 500 });
  }
}
