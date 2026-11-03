/** Build the optional host pattern for a user-configured HTTPS sync endpoint. */
export function syncHostPermissionPattern(endpoint: string): string | null {
  try {
    const url = new URL(endpoint.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return `${url.origin}/*`;
  } catch {
    return null;
  }
}

export type HostPermissionsApi = {
  contains(details: { origins: string[] }): Promise<boolean>;
  request(details: { origins: string[] }): Promise<boolean>;
};

/** Request access only to the configured origin; call directly from a user gesture. */
export async function requestSyncHostPermission(
  endpoint: string,
  permissions: HostPermissionsApi | undefined
): Promise<boolean> {
  const origin = syncHostPermissionPattern(endpoint);
  if (!origin || !permissions) return false;

  try {
    if (await permissions.contains({ origins: [origin] })) return true;
    return await permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}
