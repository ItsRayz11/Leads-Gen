import { getAllProviderStatuses, type ProviderStatus } from "@leads/workers";

export type { ProviderStatus };

/** Real connector config/capability status for the Discovery page's Sources panel. */
export async function listProviderStatuses(): Promise<ProviderStatus[]> {
  return getAllProviderStatuses();
}
