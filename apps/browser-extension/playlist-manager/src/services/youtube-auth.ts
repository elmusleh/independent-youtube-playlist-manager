/// <reference path="../../node_modules/@types/firefox-webext-browser/index.d.ts" />
import { parseOAuthResponse, getFirefoxRedirectUri } from "../utils/oauth-response";
import { hasYoutubeClientId } from "../utils/youtube-credentials";
import {
  ACCOUNT_DATA,
  hasDataConsent,
  requestDataConsent,
  requireDataConsent,
} from "../utils/data-consent";

const AUTH_LOG_KEY = "yt_auth_debug_log";
const CLIENT_ID = "456478079131-cu0s6f03kou9obge8olkron2frju5j2s.apps.googleusercontent.com";
const YT_SCOPE = "https://www.googleapis.com/auth/youtube";
const TOKEN_CACHE_KEY = "yt_auth_token_cache";

/**
 * SECURITY NOTE: OAuth tokens are stored in browser.storage.local which persists
 * across browser sessions and is accessible to any content script with storage
 * permission. Consider using browser.storage.session (if available) for tokens
 * that should be cleared when the browser closes. The current approach trades
 * security for convenience (users stay signed in across sessions).
 * @see https://developer.chrome.com/docs/extensions/reference/api/storage
 */

interface TokenCache {
  token: string;
  expiry: number;
}

const getErrorMessage = (e: any) => (e instanceof Error ? e.message : String(e));

// Mutex to prevent multiple concurrent auth flows
let authCheckPromise: Promise<boolean> | null = null;
let tokenRefreshPromise: Promise<string> | null = null;

async function appendAuthLog(msg: string): Promise<void> {
  try {
    if (window.logSystemEvent) {
      await window.logSystemEvent("INFO", "[YT-AUTH] " + msg);
    } else {
      console.log("[YT-AUTH] " + msg);
    }
  } catch {}
}

function updateIsSignedIn(val: boolean) {
  if (window._isSignedIn !== val) {
    window._isSignedIn = val;
    window.dispatchEvent(new CustomEvent("yt-auth-changed", { detail: { isSignedIn: val } }));
    appendAuthLog("Auth state changed to: " + val);
  }
}

async function getCachedToken(): Promise<string | null> {
  if (!(await hasDataConsent(ACCOUNT_DATA))) return null;
  try {
    const result = await browser.storage.local.get(TOKEN_CACHE_KEY);
    const cached = result[TOKEN_CACHE_KEY] as TokenCache | undefined;
    if (!cached) return null;

    // Allow tokens that expired within the last hour for refresh purposes
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (cached.expiry < oneHourAgo) return null;

    return cached.token;
  } catch (e) {
    return null;
  }
}

async function cacheToken(token: string, expiresIn: number): Promise<void> {
  const cache: TokenCache = { token, expiry: Date.now() + expiresIn * 1000 };
  try {
    await browser.storage.local.set({ [TOKEN_CACHE_KEY]: cache });
    appendAuthLog(
      "Token successfully cached, valid until " + new Date(cache.expiry).toLocaleTimeString()
    );
    updateIsSignedIn(true);
  } catch (err) {
    console.error("Failed to cache token:", err);
    if (err instanceof Error && err.name === "QuotaExceededError") {
      console.error("Local storage quota exceeded while caching token!");
    }
  }
}

async function fetchFreshToken(
  interactive: boolean = true,
  selectAccount: boolean = false
): Promise<string> {
  if (interactive) await requestDataConsent(ACCOUNT_DATA);
  else await requireDataConsent(ACCOUNT_DATA);
  if (tokenRefreshPromise && !interactive) return tokenRefreshPromise;

  // Guard: for interactive sign-in, require custom credentials to be set
  if (interactive) {
    try {
      const result = await browser.storage.local.get("custom_yt_credentials");
      const creds = result.custom_yt_credentials;
      if (!hasYoutubeClientId(creds)) {
        throw Object.assign(
          new Error(
            "Client ID is not configured. Please go to API Setup to enter your OAuth Client ID."
          ),
          { code: "credentials_missing" }
        );
      }
    } catch (e: any) {
      if (e.code === "credentials_missing") throw e;
      // Storage read failed — allow through rather than blocking sign-in
      console.warn("[YT-AUTH] Could not verify credentials, proceeding anyway:", e);
    }
  }

  // Firefox-specific debugging checks
  const isFirefox = navigator.userAgent.includes("Firefox");
  if (isFirefox) {
    console.log("[YT-AUTH] Checking Firefox compatibility...");
    console.log("[YT-AUTH] Cookies enabled:", navigator.cookieEnabled);
    if (!navigator.cookieEnabled) {
      console.warn(
        "[YT-AUTH] Third-party cookies are likely blocked, which can break Google Sign-In."
      );
    }
  }

  // Detect Firefox for Android (Fenix) — identity API unavailable there
  const isAndroid = /Android/i.test(navigator.userAgent);
  const hasIdentityAPI =
    !isAndroid && typeof (browser as any).identity?.launchWebAuthFlow === "function";
  const oauthState = crypto.randomUUID();

  /**
   * Parse an OAuth token from a redirect URL (handles both hash and query params).
   */
  /**
   * Tabs-based OAuth flow for Firefox for Android (Fenix).
   * Opens a tab, monitors navigation until it hits the redirect URI, then extracts the token.
   */
  async function fetchTokenViaTab(authUrl: string, redirectUri: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let authTabId: number | null = null;
      let settled = false;
      const timeout = setTimeout(
        () => settle(() => reject(new Error("Sign-in timed out. Please try again."))),
        120000
      );

      function cleanup() {
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(onUpdated);
        browser.tabs.onRemoved.removeListener(onRemoved);
        if (authTabId !== null) {
          browser.tabs.remove(authTabId).catch(() => {});
          authTabId = null;
        }
      }

      function settle(fn: () => void) {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      }

      const onUpdated = (_tabId: number, changeInfo: any, tab: any) => {
        if (_tabId !== authTabId) return;
        const url: string = changeInfo.url || tab.url || "";
        if (!url.startsWith(redirectUri)) return;
        try {
          const result = parseOAuthResponse(url, redirectUri, oauthState);
          if (result) {
            settle(() => resolve(result.token));
            cacheToken(result.token, result.expiresIn);
          } else {
            settle(() => reject(new Error("No token in redirect response")));
          }
        } catch (e) {
          settle(() => reject(e));
        }
      };

      const onRemoved = (tabId: number) => {
        if (tabId === authTabId) {
          settle(() => reject(new Error("Canceled by user")));
        }
      };

      browser.tabs.onUpdated.addListener(onUpdated);
      browser.tabs.onRemoved.addListener(onRemoved);

      browser.tabs
        .create({ url: authUrl })
        .then((tab) => {
          authTabId = tab.id ?? null;
        })
        .catch((e) => {
          settle(() => reject(e));
        });
    });
  }

  const refreshAction = async () => {
    let effectiveClientId = CLIENT_ID;
    try {
      const result = await browser.storage.local.get("custom_yt_credentials");
      if (result.custom_yt_credentials?.clientId) {
        effectiveClientId = result.custom_yt_credentials.clientId;
      }
    } catch (e) {
      console.warn("Failed to read custom client ID, falling back to default", e);
    }

    // On Android, compute the Firefox extension redirect URI manually since
    // browser.identity is unavailable. The redirect URI for Firefox extensions
    // uses the SHA-1 hash of the add-on ID, matching Firefox's native implementation.
    const redirectUri = hasIdentityAPI
      ? browser.identity.getRedirectURL()
      : await getFirefoxRedirectUri(browser.runtime.id);

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", effectiveClientId);
    url.searchParams.set("response_type", "token");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", YT_SCOPE);
    url.searchParams.set("state", oauthState);
    if (!interactive) {
      url.searchParams.set("prompt", "none");
    } else if (selectAccount) {
      url.searchParams.set("prompt", "select_account");
    }

    try {
      let responseUrl: string;

      if (hasIdentityAPI) {
        // Desktop Firefox / Chrome: use the standard identity API
        console.log("[YT-AUTH] Launching auth flow via identity API:", {
          interactive,
          selectAccount,
          redirectUri,
        });
        appendAuthLog(
          `Launching auth flow (interactive: ${interactive}, selectAccount: ${selectAccount}). Redirect URI: ${redirectUri}`
        );
        responseUrl = await browser.identity.launchWebAuthFlow({
          url: url.toString(),
          interactive: interactive,
        });
      } else {
        // Firefox for Android (Fenix): open a tab and monitor navigation
        if (!interactive) {
          // Silent refresh is not possible via tab-based flow on Android
          updateIsSignedIn(false);
          throw new Error(
            "Silent token refresh not supported on Android. Please sign in interactively."
          );
        }
        console.log("[YT-AUTH] Launching auth flow via tab (Android):", { redirectUri });
        appendAuthLog(`Launching Android tab-based auth flow. Redirect URI: ${redirectUri}`);
        const token = await fetchTokenViaTab(url.toString(), redirectUri);
        tokenRefreshPromise = null;
        return token;
      }

      const result = parseOAuthResponse(responseUrl, redirectUri, oauthState);
      if (!result) throw new Error("No token in response");

      console.log("[YT-AUTH] Successfully received token");
      await cacheToken(result.token, result.expiresIn);
      return result.token;
    } catch (err) {
      console.error("[YT-AUTH] Auth flow failed:", err);

      if (isFirefox && err instanceof Error && err.message?.includes("Canceled by user")) {
        console.warn(
          "[YT-AUTH] Canceled by user. In Firefox, this can also happen if third-party cookies are blocked."
        );
      }

      if (err instanceof Error && err.message?.includes("did not approve access")) {
        throw Object.assign(
          new Error(
            "Redirect URI mismatch: The URI sent to Google does not match what's registered. Open API Setup, copy your redirect URI(s), and add them to your Google Cloud Console OAuth client."
          ),
          { code: "redirect_uri_mismatch" }
        );
      }

      if (!interactive) updateIsSignedIn(false);
      throw err;
    } finally {
      tokenRefreshPromise = null;
    }
  };

  if (!interactive) {
    tokenRefreshPromise = refreshAction();
    return tokenRefreshPromise;
  }
  return refreshAction();
}

window.getYouTubeToken = async (): Promise<string> => {
  const cached = await getCachedToken();
  if (cached) {
    // Check if truly valid (not just within the 1-hour grace period)
    const result = await browser.storage.local.get(TOKEN_CACHE_KEY);
    const c = result[TOKEN_CACHE_KEY];
    if (c && Date.now() < c.expiry - 60000) {
      updateIsSignedIn(true);
      return cached;
    }
    // Token exists but is expired, try silent refresh
    try {
      return await fetchFreshToken(false);
    } catch (e) {
      appendAuthLog("Token refresh failed: " + getErrorMessage(e));
      throw e;
    }
  }

  // No cached token at all - we shouldn't try silent refresh as it will likely fail
  // with 'interaction_required' or 'login_required' and cause console noise.
  throw new Error("User not signed in");
};

window.isSignedIn = async (): Promise<boolean> => {
  if (authCheckPromise) return authCheckPromise;

  authCheckPromise = (async () => {
    try {
      const cached = await getCachedToken();
      if (cached !== null) {
        const result = await browser.storage.local.get(TOKEN_CACHE_KEY);
        const c = result[TOKEN_CACHE_KEY];

        if (c && Date.now() > c.expiry) {
          // Do not attempt silent refresh here — launchWebAuthFlow cannot be called
          // from a background service worker context in Chrome MV3.
          // UI-triggered flows (getYouTubeToken) will handle the refresh when needed.
          updateIsSignedIn(false);
          return false;
        }

        updateIsSignedIn(true);
        return true;
      }

      updateIsSignedIn(false);
      return false;
    } finally {
      authCheckPromise = null;
    }
  })();

  return authCheckPromise;
};

window.signIn = async (): Promise<string> => fetchFreshToken(true, true);

window.revokeYouTubeToken = async (): Promise<void> => {
  const result = await browser.storage.local.get(TOKEN_CACHE_KEY);
  const cached = result[TOKEN_CACHE_KEY];
  if (cached?.token && (await hasDataConsent(ACCOUNT_DATA))) {
    try {
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${cached.token}`);
      appendAuthLog("Token revoked from Google");
    } catch (e) {
      appendAuthLog("Revoke from Google failed: " + getErrorMessage(e));
    }
  }
  await browser.storage.local.remove(TOKEN_CACHE_KEY);
  await browser.storage.local.remove("userProfile");
  appendAuthLog("Local auth cache cleared");
  updateIsSignedIn(false);
  if (window.invalidatePlaylistCache) window.invalidatePlaylistCache();
};

// Initial Auth State Check
(async () => {
  try {
    const cached = await getCachedToken();
    const signedIn = cached !== null;
    window._isSignedIn = signedIn;
    if (!signedIn) appendAuthLog("Initial auth check: signed out");
  } catch (e) {}
  window._youtubeAuthLoading = false;
})();

export {};
