/** True only when a non-empty, trimmed OAuth Client ID is configured. */
export function hasYoutubeClientId(creds: { clientId?: unknown } | null | undefined): boolean {
  return typeof creds?.clientId === "string" && creds.clientId.trim().length > 0;
}
