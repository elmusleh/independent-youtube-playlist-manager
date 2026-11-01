export function getPlaylistCategory(p: {
  id: string;
  isLocal?: boolean;
  isTagged?: boolean;
}): string {
  if (p.isLocal || (p.id && p.id.startsWith("local-"))) return "local";
  if (p.id === "LIKED") return "liked";
  if (p.id === "UPLOADS") return "uploaded";
  if (p.isTagged) return "youtube";
  return "account";
}
