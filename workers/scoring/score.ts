import { SCORE_DIMENSIONS, type RawSignal, type ScoreDimension, type Tier, type Vertical } from "@leads/core";

export interface LeadDraft {
  vertical: Vertical;
  projectName: string;
  signals: RawSignal[];
  hasNamedContact: boolean;
}

/**
 * Scoring is split across the six dimensions `lead_scores` has columns for
 * rather than summed into one number, because the sum hid *why* a lead ranked
 * where it did: a company with three open roles and no way to contact anyone
 * scored the same as one with a named decision-maker and a disclosed budget,
 * and both read "70".
 *
 * Each dimension is scored 0–100 against the points available in that
 * dimension for that vertical, so "intent 80, contactability 0" means
 * something on its own and stays comparable between verticals whose rule sets
 * have different point totals.
 *
 * The dimension names and labels live in @leads/core because the web app
 * renders them from the persisted columns.
 */
export { SCORE_DIMENSIONS, DIMENSION_LABELS, type ScoreDimension } from "@leads/core";

export interface ScoreRule {
  id: string;
  description: string;
  /** Which dimension this rule's points belong to. */
  dimension: ScoreDimension;
  /** Points toward this dimension's subtotal. */
  weight: number;
  test: (draft: LeadDraft) => boolean | number; // number = repeat count (weight * count, capped by `cap`)
  /**
   * Max total points this rule can contribute. Required when `test` returns
   * a count — an uncapped countable rule has no maximum, which would leave
   * its dimension with no denominator to normalize against.
   */
  cap?: number;
}

/** 0–100 per dimension; null when this vertical's rule set has no rules for it. */
export type DimensionScores = Record<ScoreDimension, number | null>;

export interface MatchedRule {
  id: string;
  /** The rule description — `lead_scores.breakdown` already stores this shape. */
  label: string;
  points: number;
  dimension: ScoreDimension;
}

export interface ScoreResult {
  score: number;
  tier: Tier;
  matchedRules: MatchedRule[];
  dimensions: DimensionScores;
  /** Explains a tier held below what the score alone would give, else null. */
  tierLimitedBy: string | null;
}

/**
 * How much each dimension counts toward the overall score, per vertical.
 *
 * A dimension is omitted when the vertical has no rules for it: "general"
 * leads come from public posts with no company-size or funding data to read,
 * so scoring them on company quality would mean scoring every one of them
 * zero on a sixth of the total.
 */
export type DimensionWeights = Partial<Record<ScoreDimension, number>>;

export const VERTICAL_DIMENSION_WEIGHTS: Record<Vertical, DimensionWeights> = {
  // A hiring post is the strongest intent signal in the app: someone has
  // budget approved and is publicly asking for the work.
  hiring: {
    intent: 30,
    companyQuality: 20,
    contactability: 15,
    freshness: 15,
    evidence: 10,
    fit: 10,
  },
  // Fuzzier by nature — a keyword match is a starting point for triage, so
  // corroboration and recency carry more of the weight than the signal text.
  general: {
    intent: 25,
    fit: 20,
    evidence: 20,
    freshness: 20,
    contactability: 15,
  },
  // No public directory data to lean on, so this leans on what the agency
  // says about itself: which channels it runs and whether it has crypto
  // clients matters more than when it last posted.
  card_affiliate: {
    fit: 30,
    companyQuality: 25,
    intent: 20,
    contactability: 15,
    evidence: 10,
  },
};

/**
 * Score-to-tier cutoffs, highest first. Now read against a normalized
 * weighted average, so 85 means "85% of the strength this vertical can
 * measure" rather than "85 points happened to accumulate".
 */
const TIER_THRESHOLDS: { tier: Tier; min: number }[] = [
  { tier: "A+", min: 85 },
  { tier: "A", min: 70 },
  { tier: "B", min: 50 },
  { tier: "C", min: 25 },
  { tier: "Low Priority", min: 0 },
];

/** Best to worst — the order a gate caps against. */
const TIER_ORDER: Tier[] = ["A+", "A", "B", "C", "Low Priority"];

/**
 * Ceilings no score can lift, because these dimensions gate whether the lead
 * can be *acted on* rather than how attractive it is.
 *
 * A lead with nobody to contact cannot be worked today however good it looks,
 * and one with no buying signal is a name on a list. Both are still scored
 * and still listed — they just don't outrank leads you can act on. Contact
 * enrichment re-scores the lead, which is what lifts the first gate.
 */
const TIER_GATES: { dimension: ScoreDimension; max: Tier; reason: string }[] = [
  { dimension: "contactability", max: "B", reason: "no named contact found yet" },
  { dimension: "intent", max: "C", reason: "no active buying signal" },
];

/** The most a rule can contribute, which is what its dimension normalizes against. */
function maxContribution(rule: ScoreRule): number {
  return Math.max(0, rule.cap ?? rule.weight);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tierForScore(score: number): Tier {
  return TIER_THRESHOLDS.find((t) => score >= t.min)!.tier;
}

function worseOf(a: Tier, b: Tier): Tier {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

export function scoreLead(draft: LeadDraft, rules: ScoreRule[]): ScoreResult {
  const matchedRules: MatchedRule[] = [];
  const earned = {} as Record<ScoreDimension, number>;
  const available = {} as Record<ScoreDimension, number>;
  for (const dimension of SCORE_DIMENSIONS) {
    earned[dimension] = 0;
    available[dimension] = 0;
  }

  for (const rule of rules) {
    available[rule.dimension] += maxContribution(rule);

    const result = rule.test(draft);
    if (!result) continue;

    const count = typeof result === "number" ? result : 1;
    let points = rule.weight * count;
    if (rule.cap != null) points = Math.min(points, rule.cap);

    earned[rule.dimension] += points;
    matchedRules.push({
      id: rule.id,
      label: rule.description,
      points: Math.round(points),
      dimension: rule.dimension,
    });
  }

  const dimensions = {} as DimensionScores;
  for (const dimension of SCORE_DIMENSIONS) {
    dimensions[dimension] =
      available[dimension] > 0 ? clampPercent((100 * earned[dimension]) / available[dimension]) : null;
  }

  const weights = VERTICAL_DIMENSION_WEIGHTS[draft.vertical] ?? {};

  // Blended over the dimensions this vertical both scores and weights, so a
  // vertical that can't measure something isn't penalized for it.
  let weightedTotal = 0;
  let weightSum = 0;
  for (const dimension of SCORE_DIMENSIONS) {
    const dimensionScore = dimensions[dimension];
    const weight = weights[dimension] ?? 0;
    if (dimensionScore === null || weight <= 0) continue;
    weightedTotal += weight * dimensionScore;
    weightSum += weight;
  }

  const score = weightSum > 0 ? clampPercent(weightedTotal / weightSum) : 0;

  let tier = tierForScore(score);
  let tierLimitedBy: string | null = null;
  for (const gate of TIER_GATES) {
    // A gate only applies where the vertical actually measures that
    // dimension — an unmeasured dimension is unknown, not absent.
    if (dimensions[gate.dimension] !== 0) continue;
    const gated = worseOf(tier, gate.max);
    if (gated !== tier) {
      tier = gated;
      tierLimitedBy = gate.reason;
    }
  }

  return { score, tier, matchedRules, dimensions, tierLimitedBy };
}
