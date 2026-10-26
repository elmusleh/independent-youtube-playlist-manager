// Firefox's data permissions are separate from host/API permissions. Chrome has
// no equivalent API; its disclosures are maintained in the store privacy form.
type DataType = "authenticationInfo" | "personallyIdentifyingInfo" | "searchTerms";
export const ACCOUNT_DATA: DataType[] = ["authenticationInfo", "personallyIdentifyingInfo"];

function context(types: DataType[]) {
  const api = (globalThis as any).browser || (globalThis as any).chrome;
  const optional: string[] =
    api?.runtime?.getManifest?.().browser_specific_settings?.gecko?.data_collection_permissions
      ?.optional || [];
  return { api, needed: types.filter((type) => optional.includes(type)) };
}

export async function hasDataConsent(types: DataType[]): Promise<boolean> {
  const { api, needed } = context(types);
  if (!needed.length) return true;
  try {
    const granted = await api.permissions.getAll();
    return needed.every((type) => granted.data_collection?.includes(type));
  } catch {
    return false;
  }
}

// Call directly from a user action, before any storage/network awaits, so that
// Firefox retains the user gesture needed to display its consent prompt.
export async function requestDataConsent(types: DataType[]): Promise<void> {
  const { api, needed } = context(types);
  if (!needed.length) return;
  if (!(await api.permissions.request({ data_collection: needed }))) {
    throw new Error(
      "Permission declined. This optional feature remains off; local playlists still work."
    );
  }
}

export async function requireDataConsent(types: DataType[]): Promise<void> {
  if (!(await hasDataConsent(types))) {
    throw new Error(
      "Data permission is needed. Use Sign In or Search to enable this optional feature."
    );
  }
}
