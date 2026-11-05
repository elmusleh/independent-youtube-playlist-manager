// apps/web-portal/app/api/pair/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "generate") {
      // Generate a 6-digit pairing code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Store in database with 10-minute expiry
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error } = await supabase.from("pairing_codes").insert({
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
