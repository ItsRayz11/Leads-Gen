import type { RawSignal, Tier, Vertical } from "@leads/core";

export interface LeadDraft {
  vertical: Vertical;
  projectName: string;
  signals: RawSignal[];
  hasNamedContact: boolean;
}

export interface ScoreRule {
  id: string;
  description: string;
  weight: number;
  test: (draft: LeadDraft) => boolean | number; // number = repeat count (weight * count, capped by `cap`)
  cap?: number; // max total points this rule can contribute
}

export interface ScoreResult {
  score: number;
  tier: Tier;
  matchedRules: { id: string; label: string; points: number }[];
}

/**
 * Score-to-tier cutoffs, highest first. These are deliberately looser than
 * a 95+ A+ band: the rule weights here top out well below 100 for a realistic
 * lead, so a 95 cutoff would leave A+ almost always empty and collapse the
 * useful signal into A. Anything below 25 is filed as "Low Priority" rather
 * than sharing the C band with leads that still have a reason to be worked.
 *
 * Still hardcoded — making these configurable is tracked separately.
 */
const TIER_THRESHOLDS: { tier: Tier; min: number }[] = [
  { tier: "A+", min: 85 },
  { tier: "A", min: 70 },
  { tier: "B", min: 50 },
  { tier: "C", min: 25 },
  { tier: "Low Priority", min: 0 },
];

export function scoreLead(draft: LeadDraft, rules: ScoreRule[]): ScoreResult {
  const matchedRules: { id: string; label: string; points: number }[] = [];
  let total = 0;

  for (const rule of rules) {
    const result = rule.test(draft);
    if (!result) continue;

    const count = typeof result === "number" ? result : 1;
    let points = rule.weight * count;
    if (rule.cap != null) points = Math.min(points, rule.cap);

    total += points;
    matchedRules.push({ id: rule.id, label: rule.description, points: Math.round(points) });
  }

  const score = Math.max(0, Math.min(100, Math.round(total)));
  const tier = TIER_THRESHOLDS.find((t) => score >= t.min)!.tier;

  return { score, tier, matchedRules };
}
