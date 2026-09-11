const SUFFIX_RE = /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company)\.?\s*$/i;

/**
 * Guesses at the board-token/slug a company might use on Greenhouse, Lever,
 * or Ashby, from a free-text company name — those platforms don't expose a
 * name-to-slug lookup, so this is what /api/target-companies/resolve tries
 * against each provider's public API.
 */
export function candidateSlugs(name: string): string[] {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return [];
  const withoutSuffix = trimmed.replace(SUFFIX_RE, "").trim();

  const variants = new Set<string>();
  for (const base of [trimmed, withoutSuffix]) {
    if (!base) continue;
    const alnumOnly = base.replace(/[^a-z0-9]+/g, "");
    const hyphenated = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (alnumOnly) variants.add(alnumOnly);
    if (hyphenated) variants.add(hyphenated);
  }
  return Array.from(variants).slice(0, 8);
}
