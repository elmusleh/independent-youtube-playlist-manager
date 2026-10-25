export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, totalPages), Math.max(1, Math.trunc(page) || 1));
}

/** First/last pages, current neighbors, and inert gaps; constant work for large lists. */
export function getPageItems(
  totalPages: number,
  currentPage: number,
  budget: 5 | 7 = 7
): (number | "ellipsis")[] {
  const total = Math.max(1, Math.trunc(totalPages));
  const page = clampPage(currentPage, total);
  if (total <= budget) return Array.from({ length: total }, (_, i) => i + 1);
  const radius = (budget - 5) / 2;
  let start = page - radius;
  let end = page + radius;
  if (page <= budget - 3) {
    start = 2;
    end = budget - 2;
  } else if (page >= total - budget + 4) {
    start = total - budget + 3;
    end = total - 1;
  }
  const items: (number | "ellipsis")[] = [1];
  if (start > 2) items.push(start === 3 ? 2 : "ellipsis");
  for (let value = start; value <= end; value++) items.push(value);
  if (end < total - 1) items.push(end === total - 2 ? total - 1 : "ellipsis");
  items.push(total);
  return items;
}
