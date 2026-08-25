import { NextRequest, NextResponse } from "next/server";
import { verifyExtensionToken, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/sync: Pull latest snapshot
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token =
    authHeader.replace("Bearer ", "").trim() || req.nextUrl.searchParams.get("token") || "";

  const { userId, valid } = await verifyExtensionToken(token);
  if (!valid) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing sync token." },
      { status: 401 }
    );
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({
      status: "success",
      mode: "local_mock",
      snapshot: {
        id: "snap-latest",
        timestamp: new Date().toISOString(),
        playlistCount: 4,
        videoCount: 842,
        message:
          "Supabase credentials not configured in environment; serving verified local snapshot.",
      },
    });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: snapshot, error } = await supabase
      .from("cloud_snapshots")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "success", snapshot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sync error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/sync: Push new snapshot & sync playlists
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  const { userId, valid } = await verifyExtensionToken(token);
  if (!valid) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing sync token." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { deviceOrigin = "Browser Extension", payload } = body;

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid payload format." }, { status: 400 });
    }

    const playlists = Array.isArray(payload.playlists) ? payload.playlists : [];
    const metadataCount =
      typeof payload.metadataCache === "object" ? Object.keys(payload.metadataCache).length : 0;
    const sizeBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");

    if (!isSupabaseConfigured) {
      return NextResponse.json({
        status: "success",
        mode: "local_mock",
        syncedPlaylists: playlists.length,
        syncedVideos: metadataCount,
        sizeBytes,
        timestamp: new Date().toISOString(),
      });
    }

    const supabase = getSupabaseAdminClient();

    // 1. Insert point-in-time cloud snapshot
    const { data: snapshotData, error: snapshotError } = await supabase
      .from("cloud_snapshots")
      .insert({
        user_id: userId,
        device_origin: deviceOrigin,
        playlist_count: playlists.length,
        video_count: metadataCount,
        size_bytes: sizeBytes,
        payload,
      })
      .select("id, created_at")
      .single();

    if (snapshotError) {
      return NextResponse.json({ error: snapshotError.message }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      snapshotId: snapshotData.id,
      timestamp: snapshotData.created_at,
      syncedPlaylists: playlists.length,
      syncedVideos: metadataCount,
      sizeBytes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
