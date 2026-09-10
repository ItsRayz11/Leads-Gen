import type { Vertical } from "@leads/core";
import type { ScoreRule } from "./score.js";
import { vertical1HiringRules } from "./rules/vertical1-hiring.js";
import { vertical2GeneralRules } from "./rules/vertical2-general.js";
import { vertical3CardAffiliateRules } from "./rules/vertical3-card-affiliate.js";

/**
 * Which rule set scores which vertical. Kept in one place so a lead read back
 * from the database can be re-scored without the caller having to know.
 */
export const RULES_BY_VERTICAL: Record<Vertical, ScoreRule[]> = {
  hiring: vertical1HiringRules,
  general: vertical2GeneralRules,
  card_affiliate: vertical3CardAffiliateRules,
};
