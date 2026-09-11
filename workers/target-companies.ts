import { listTargetCompanies, type TargetCompanySource } from "@leads/db/target-companies.js";

export interface ResolvedTargetCompany {
  identifier: string;
  label: string | null;
  extra: Record<string, unknown> | null;
}

/**
 * The companies configured for one connector, database rows first. Returns
 * null (rather than an empty array) when the database has no *enabled* rows
 * for this source, so callers can fall back to their config/target-companies/
 * JSON file — a workspace that seeded companies via the file, or that hasn't
 * set the service-role env vars needed to reach the database at all, keeps
 * working exactly as before. See packages/db/target-companies.ts for why the
 * database read itself fails open (empty array) rather than throwing.
 */
export async function resolveTargetCompanies(source: TargetCompanySource): Promise<ResolvedTargetCompany[] | null> {
  const rows = await listTargetCompanies(source);
  const enabled = rows.filter((r) => r.enabled);
  if (enabled.length === 0) return null;
  return enabled.map((r) => ({
    identifier: r.identifier,
    label: r.label,
    extra: (r.extra as Record<string, unknown> | null) ?? null,
  }));
}
