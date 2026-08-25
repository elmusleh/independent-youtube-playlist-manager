import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "placeholder-anon-key";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co"
);

// Browser client
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}

// Server Admin client (bypasses RLS with service role for token verification)
export function getSupabaseAdminClient() {
  const key = supabaseServiceRoleKey || supabaseAnonKey;
  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Token Verification helper
export async function verifyExtensionToken(
  token: string
): Promise<{ userId: string; valid: boolean }> {
  if (!token || !token.startsWith("yph_")) {
    return { userId: "", valid: false };
  }

  if (!isSupabaseConfigured) {
    // In local development or standalone demo mode, validate standard formatted tokens
    return { userId: "dev-local-user-id", valid: true };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("api_tokens")
      .select("user_id, token")
      .eq("token", token)
      .single();

    if (error || !data) {
      return { userId: "", valid: false };
    }

    // Update last_used_at timestamp asynchronously
    supabase
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("token", token)
      .then();

    return { userId: data.user_id, valid: true };
  } catch {
    return { userId: "", valid: false };
  }
}
