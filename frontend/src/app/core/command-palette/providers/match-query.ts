/**
 * Returns true when every whitespace-separated word of the query appears
 * (case-insensitive) in the combined text of the given fields.
 * An empty or blank query matches everything.
 */
export function matchesQuery(
  query: string,
  ...fields: (string | undefined)[]
): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return true;
  }
  const haystack = fields
    .filter((field): field is string => !!field)
    .join(' ')
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}
