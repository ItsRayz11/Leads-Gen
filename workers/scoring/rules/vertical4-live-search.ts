import type { ScoreRule } from "../score.js";
import { anySignal, evidenceRules, namedContactRule, recencyCredit } from "./shared.js";

/**
 * A live-search result has no disclosed rate, no funding signal, no
 * headcount — just whatever Gemini's grounded search surfaced and the real
 * citation URL behind it. Scoring here leans almost entirely on fit (did the
 * result actually match what was asked for) and evidence (is there a real
 * source), the two things this connector can honestly claim to know.
 *
 * No companyQuality rules, same reasoning as vertical2 (general): nothing
 * here carries funding/headcount data, so the vertical's dimension weights
 * (score.ts) leave that dimension out rather than scoring every lead zero
 * on a dimension it has no way to answer.
 */
export const vertical4LiveSearchRules: ScoreRule[] = [
  // ---- intent: does the search result itself read like a live opportunity ----
  {
    id: "explicit-buying-signal",
    description: "The search result itself describes an active need (hiring, RFP, budget, launch)",
    dimension: "intent",
    weight: 20,
    test: (d) => anySignal(d, (m) => Boolean(m.hasExplicitSignal)),
  },

  // ---- fit: how confident was the model that this matches the request ----
  {
    id: "high-relevance",
    description: "Gemini rated this result as a strong match for the search",
    dimension: "fit",
    weight: 25,
    test: (d) => anySignal(d, (m) => m.relevance === "high"),
  },
  {
    id: "medium-relevance",
    description: "Gemini rated this result as a plausible match for the search",
    dimension: "fit",
    weight: 12,
    test: (d) => anySignal(d, (m) => m.relevance === "medium"),
  },

  // ---- freshness: is the page/result itself current ----
  {
    id: "found-recently",
    description: "Discovered in this run (full credit within 3 days, decaying to 0 by day 14)",
    dimension: "freshness",
    weight: 15,
    test: (d) => recencyCredit(d, 3, 14),
  },

  // ---- evidence: a live search result is only as good as its citation ----
  ...evidenceRules({ linkWeight: 20, corroborationWeight: 10, corroborationCap: 20 }),

  // ---- contactability ----
  namedContactRule(10),
];
