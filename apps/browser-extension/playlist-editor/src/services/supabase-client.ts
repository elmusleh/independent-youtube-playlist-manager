import { createClient, type SupabaseClient, type Session, type User } from "@supabase/supabase-js";

declare const chrome: any;
declare const browser: any;

// Default Supabase project endpoints (overridable in Extension Settings)
const DEFAULT_SUPABASE_URL = "https://placeholder.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "placeholder-anon-key";

// Safe cross-browser storage adapter for MV3 (Chrome & Firefox Desktop/Android)
const webExtStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof browser !== "undefined" && browser?.storage?.local) {
        const data = await browser.storage.local.get(key);
        return data[key] || null;
      }
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        const data = await chrome.storage.local.get(key);
        return data[key] || null;
      }
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof browser !== "undefined" && browser?.storage?.local) {
        await browser.storage.local.set({ [key]: value });
        return;
      }
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        await chrome.storage.local.set({ [key]: value });
        return;
      }
      localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof browser !== "undefined" && browser?.storage?.local) {
        await browser.storage.local.remove(key);
        return;
      }
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        await chrome.storage.local.remove(key);
        return;
      }
      localStorage.removeItem(key);
    } catch {}
  },
};

let _supabaseInstance: SupabaseClient | null = null;
let _cachedUrl = DEFAULT_SUPABASE_URL;
let _cachedKey = DEFAULT_SUPABASE_ANON_KEY;

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (_supabaseInstance) return _supabaseInstance;

  // Check if custom URL/Key is stored in extension settings
  try {
    const stored = await webExtStorageAdapter.getItem("yph_supabase_config");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.url && parsed.key) {
        _cachedUrl = parsed.url;
        _cachedKey = parsed.key;
      }
    }
  } catch {}

  _supabaseInstance = createClient(_cachedUrl, _cachedKey, {
    auth: {
      storage: webExtStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Disabled in MV3 service workers
    },
  });

  return _supabaseInstance;
}

export function isAndroidPlatform(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/**
 * Initiates OAuth login using chrome.identity.launchWebAuthFlow
 */
export async function loginWithOAuth(provider: "google" | "github"): Promise<Session | null> {
  const client = await getSupabaseClient();

  const identityApi = (typeof chrome !== "undefined" && chrome?.identity) || (typeof browser !== "undefined" && browser?.identity);
  if (isAndroidPlatform() || !identityApi || !identityApi.launchWebAuthFlow) {
    throw new Error("OAuth popup flow is unavailable on Android/Fenix. Please use Email/Password sign-in.");
  }

  const redirectUrl = identityApi.getRedirectURL("supabase");
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) throw error || new Error("Auth URL generation failed");

  const authResponseUrl = await identityApi.launchWebAuthFlow({
    url: data.url,
    interactive: true,
  });

  if (authResponseUrl) {
    const hashPart = authResponseUrl.includes("#") ? authResponseUrl.split("#")[1] : authResponseUrl.split("?")[1] || "";
    const params = new URLSearchParams(hashPart);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      const { data: sessionData, error: sessionErr } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionErr) throw sessionErr;
      return sessionData.session;
    }
  }

  return null;
}

/**
 * Email/Password Sign In
 */
export async function loginWithEmail(email: string, password: string): Promise<Session | null> {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

/**
 * Email/Password Sign Up
 */
export async function signUpWithEmail(email: string, password: string): Promise<User | null> {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

/**
 * Sign Out
 */
export async function signOut(): Promise<void> {
  const client = await getSupabaseClient();
  await client.auth.signOut();
}

/**
 * Get Active Session
 */
export async function getSession(): Promise<Session | null> {
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  return data.session;
}

/**
 * Configure Custom Supabase Endpoint
 */
export async function configureSupabase(url: string, anonKey: string): Promise<void> {
  _cachedUrl = url;
  _cachedKey = anonKey;
  _supabaseInstance = null; // Recreate client next time
  await webExtStorageAdapter.setItem("yph_supabase_config", JSON.stringify({ url, key: anonKey }));
}
