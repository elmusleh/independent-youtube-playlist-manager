export function hasCompleteMetadata(meta: any): boolean {
  if (!meta) return false;
  if (meta.isPrivate || meta.isDeleted || meta.isBroken) return true;
  return Boolean(
    meta.title?.trim() &&
    meta.channel?.trim() &&
    (meta.durationISO || meta.duration || meta.durationSeconds > 0 || meta.isLive)
  );
}
