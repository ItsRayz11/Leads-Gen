import type { ScoreRule } from "../score.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function anySignal(draft: Parameters<ScoreRule["test"]>[0], pred: (meta: Record<string, unknown>) => boolean) {
  return draft.signals.some((s) => pred(s.meta ?? {}));
}

/**
 * Weaker signal-to-weight mapping than the other verticals since "general"
 * is inherently fuzzier — a keyword match here is a starting point for
 * manual triage, not proof of budget/intent the way a disclosed hiring rate
 * is.
 */
export const vertical2GeneralRules: ScoreRule[] = [
  {
    id: "high-engagement",
    description: "Post has strong community engagement (>= 50 points)",
    weight: 15,
    test: (d) => anySignal(d, (m) => typeof m.engagementPoints === "number" && m.engagementPoints >= 50),
  },
  {
    id: "is-launch-post",
    description: "A launch post (Show HN / Launch HN) — a brand-new company forming",
    weight: 15,
    test: (d) => anySignal(d, (m) => Boolean(m.isLaunchPost)),
  },
  {
    id: "active-discussion",
    description: "Post has meaningful discussion (>= 20 comments)",
    weight: 10,
    test: (d) => anySignal(d, (m) => typeof m.numComments === "number" && m.numComments >= 20),
  },
  {
    id: "posted-recently",
    description: "Posting is recent (full credit within 7 days, decaying to 0 by day 30)",
    weight: 15,
    test: (d) => {
      const postedAt = d.signals
        .map((s) => (s.meta?.postedAt instanceof Date ? s.meta.postedAt : null))
        .find((v): v is Date => v != null);
      if (!postedAt) return false;
      const ageDays = (Date.now() - postedAt.getTime()) / DAY_MS;
      if (ageDays <= 7) return 1;
      if (ageDays >= 30) return false;
      return 1 - (ageDays - 7) / (30 - 7);
    },
  },
  {
    id: "multiple-mentions",
    description: "Matched more than one configured keyword/search config",
    weight: 10,
    cap: 20,
    test: (d) => Math.max(0, d.signals.length - 1),
  },
  {
    id: "named-contact-found",
    description: "A named decision-maker was found via public sources",
    weight: 15,
    test: (d) => d.hasNamedContact,
  },
];
