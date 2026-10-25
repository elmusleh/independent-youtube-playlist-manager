/** Match Firefox's identity.getRedirectURL derivation on Android without identity APIs. */
export async function getFirefoxRedirectUri(extensionId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(extensionId));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `https://${hash}.extensions.allizom.org/`;
}

/** Validate the redirect and request state before accepting an OAuth access token. */
export function parseOAuthResponse(
  responseUrl: string,
  redirectUri: string,
  expectedState: string
): { token: string; expiresIn: number } | null {
  const response = new URL(responseUrl);
  const redirect = new URL(redirectUri);
  if (response.origin !== redirect.origin || response.pathname !== redirect.pathname)
    throw new Error("Unexpected authentication redirect.");
  const params = new URLSearchParams(response.hash.slice(1));
  const state = params.get("state") || response.searchParams.get("state");
  if (!expectedState || state !== expectedState)
    throw new Error("Authentication state mismatch. Please try signing in again.");
  const error = params.get("error") || response.searchParams.get("error");
  if (error) throw new Error(`Auth error: ${error}`);
  const token = params.get("access_token") || response.searchParams.get("access_token");
  if (!token) return null;
  const expiry = Number(
    params.get("expires_in") || response.searchParams.get("expires_in") || "3600"
  );
  return { token, expiresIn: Number.isFinite(expiry) && expiry > 0 ? expiry : 3600 };
}
