import type { ScoreRule } from "../score.js";
import { anySignal, evidenceRules, namedContactRule, recencyCredit } from "./shared.js";

/**
 * Weaker signal-to-weight mapping than the other verticals since "general" is
 * inherently fuzzier — a keyword match here is a starting point for manual
 * triage, not proof of budget the way a disclosed hiring rate is.
 *
 * No company-quality rules: these leads come from public posts that carry no
 * funding or headcount data, and scoring a dimension nothing can answer would
 * mean docking every one of them for it. The vertical's dimension weights
 * leave it out to match.
 */
export const vertical2GeneralRules: ScoreRule[] = [
  // ---- intent: is anyone actually engaging with this ----
  {
    id: "high-engagement",
    description: "Post has strong community engagement (>= 50 points)",
    dimension: "intent",
    weight: 15,
    test: (d) => anySignal(d, (m) => typeof m.engagementPoints === "number" && m.engagementPoints >= 50),
  },
  {
    id: "active-discussion",
    description: "Post has meaningful discussion (>= 20 comments)",
    dimension: "intent",
    weight: 10,
    test: (d) => anySignal(d, (m) => typeof m.numComments === "number" && m.numComments >= 20),
  },

  // ---- fit: a company forming is a company that needs marketing ----
  {
    id: "is-launch-post",
    description: "A launch post (Show HN / Launch HN) — a brand-new company forming",
    dimension: "fit",
    weight: 15,
    test: (d) => anySignal(d, (m) => Boolean(m.isLaunchPost)),
  },
  {
    id: "has-no-website",
    description: "A local business with no website on file (Serper/Decodo Maps) — a direct fit for web/marketing services",
    dimension: "fit",
    weight: 15,
    test: (d) => anySignal(d, (m) => m.hasWebsite === false),
  },

  // ---- freshness: a month-old thread is cold ----
  {
    id: "posted-recently",
    description: "Posting is recent (full credit within 7 days, decaying to 0 by day 30)",
    dimension: "freshness",
    weight: 15,
    test: (d) => recencyCredit(d, 7, 30),
  },

  // ---- evidence: how well corroborated is a fuzzy match ----
  {
    id: "multiple-mentions",
    description: "Matched more than one configured keyword/search config",
    dimension: "evidence",
    weight: 10,
    cap: 20,
    test: (d) => Math.max(0, d.signals.length - 1),
  },
  ...evidenceRules({ linkWeight: 10, corroborationWeight: 10, corroborationCap: 20 }),

  // ---- contactability ----
  namedContactRule(15),
];
