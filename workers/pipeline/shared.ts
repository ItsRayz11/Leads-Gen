import type { Vertical } from "@leads/core";
import type { Freshness } from "@leads/db/types.js";

export const VERTICAL_LEAD_TITLE: Record<Vertical, string> = {
  hiring: "Hiring signal opportunity",
  general: "General B2B/B2C opportunity",
  card_affiliate: "Bitget Card affiliate opportunity",
};

export function normalizeDomain(website: string | undefined | null): string | null {
  if (!website) return null;
  try {
    const withProtocol = website.startsWith("http") ? website : `https://${website}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

const FRESHNESS_DAYS = { fresh: 7, recent: 30, aging: 90 } as const;

export function freshnessFromDate(date: Date | string | null | undefined): Freshness {
  if (!date) return "unknown";
  const days = (Date.now() - new Date(date).getTime()) / 86_400_000;
  if (days <= FRESHNESS_DAYS.fresh) return "fresh";
  if (days <= FRESHNESS_DAYS.recent) return "recent";
  if (days <= FRESHNESS_DAYS.aging) return "aging";
  return "stale";
}
