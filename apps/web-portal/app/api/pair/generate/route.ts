// apps/web-portal/app/api/pair/generate/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceType } = body;

    // Generate a 6-digit pairing code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in database with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabase.from("pairing_codes").insert({
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
