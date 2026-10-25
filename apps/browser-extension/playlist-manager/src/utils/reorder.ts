/** Move by stable identity so filtered/paginated views cannot reorder a hidden item. */
export function reorderItems<T extends { id: string | number }>(
  items: T[],
  sourceId: string | number,
  targetId: string | number
): T[] {
  const from = items.findIndex((item) => String(item.id) === String(sourceId));
  const to = items.findIndex((item) => String(item.id) === String(targetId));
  if (from < 0 || to < 0 || from === to) return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
