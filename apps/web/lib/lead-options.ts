import type {
  LeadStatus,
  LeadTier,
  LeadVertical,
  Priority,
  SignalStrength,
  SourceType,
  VerificationStatus,
} from "@leads/db/types.js";

/**
 * The option lists every lead form and inline select shares, so a schema
 * change lands in one place instead of five components.
 */
export const LEAD_STATUSES: LeadStatus[] = [
  "new", "researching", "qualified", "contacted", "follow_up", "replied",
  "meeting", "negotiation", "won",
  "no_response", "rejected", "not_interested", "not_a_fit", "lost", "on_hold",
];

export const LEAD_TIERS: LeadTier[] = ["A+", "A", "B", "C", "Low Priority"];
export const LEAD_VERTICALS: LeadVertical[] = ["hiring", "general", "card_affiliate", "live_search"];
export const LEAD_PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];
export const SIGNAL_STRENGTH_OPTIONS: SignalStrength[] = ["weak", "moderate", "strong"];
export const SOURCE_TYPES: SourceType[] = ["free", "paid"];
export const VERIFICATION_STATUSES: VerificationStatus[] = [
  "unverified",
  "needs_verification",
  "partially_verified",
  "verified",
];

/** Human-readable labels for the vertical codes stored on `leads.vertical`. */
export const VERTICAL_LABELS: Record<LeadVertical, string> = {
  hiring: "Hiring signal",
  general: "General B2B / B2C",
  card_affiliate: "Bitget Card affiliate",
  live_search: "Live web search",
};

export function humanize(value: string): string {
  return value.replace(/_/g, " ");
}
