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

/** Passively check whether host access is already granted (safe outside user gestures). */
export async function checkSyncHostPermission(
  endpoint: string,
  permissions: HostPermissionsApi | undefined
): Promise<boolean> {
  const origin = syncHostPermissionPattern(endpoint);
  if (!origin || !permissions?.contains) return false;
  try {
    return await permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
}

/**
 * Request access to the configured origin.
 *
 * IMPORTANT (Firefox MV3): `permissions.request()` MUST be invoked synchronously
 * during the user click/change event with ZERO preceding `await` calls. Calling
 * `await permissions.contains()` beforehand breaks Firefox's transient user-input
 * handler and causes `permissions.request()` to reject without showing the prompt.
 * In both Firefox and Chrome, `permissions.request()` resolves to `true` immediately
 * without prompting when access has already been granted.
 */
export async function requestSyncHostPermission(
  endpoint: string,
  permissions: HostPermissionsApi | undefined
): Promise<boolean> {
  const origin = syncHostPermissionPattern(endpoint);
  if (!origin || !permissions) return false;

  try {
    const requestPromise = permissions.request({ origins: [origin] });
    const granted = await requestPromise;
    if (granted) return true;
    return (await permissions.contains?.({ origins: [origin] })) ?? false;
  } catch {
    try {
      return (await permissions.contains?.({ origins: [origin] })) ?? false;
    } catch {
      return false;
    }
  }
}
