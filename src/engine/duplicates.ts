/** Flag slugs that share a substitute group. Streaming is a category, not a duplicate. */
export function duplicateSlugs(
  owned: string[],
  groups: Record<string, string[]>,
): Set<string> {
  const have = new Set(owned);
  const flagged = new Set<string>();
  for (const members of Object.values(groups)) {
    const hits = members.filter((slug) => have.has(slug));
    if (hits.length >= 2) hits.forEach((slug) => flagged.add(slug));
  }
  return flagged;
}
