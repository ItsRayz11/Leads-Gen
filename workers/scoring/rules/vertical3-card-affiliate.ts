import type { ScoreRule } from "../score.js";

function anySignal(draft: Parameters<ScoreRule["test"]>[0], pred: (meta: Record<string, unknown>) => boolean) {
  return draft.signals.some((s) => pred(s.meta ?? {}));
}

/**
 * No directory/rating data is available for free (Clutch/DesignRush have no
 * public API), so this leans entirely on self-reported signals from the
 * agency's own site/Twitter: disclosed spend, channel breadth, prior
 * Web3/crypto client work (cross-sell fit for a crypto card), and scale.
 */
export const vertical3CardAffiliateRules: ScoreRule[] = [
  {
    id: "ad-spend-disclosed",
    description: "Agency's own site discloses a specific ad-spend figure",
    weight: 20,
    test: (d) => anySignal(d, (m) => Boolean(m.adSpendMentioned)),
  },
  {
    id: "high-ad-spend",
    description: "Disclosed ad spend is >= $1M",
    weight: 15,
    test: (d) => anySignal(d, (m) => typeof m.adSpendUsd === "number" && m.adSpendUsd >= 1_000_000),
  },
  {
    id: "multi-channel",
    description: "Manages multiple paid channels (Meta + Google + TikTok, etc.)",
    weight: 15,
    test: (d) => {
      const maxChannels = d.signals.reduce((max, s) => {
        const n = typeof s.meta?.channelsCount === "number" ? s.meta.channelsCount : 0;
        return Math.max(max, n);
      }, 0);
      return maxChannels >= 2;
    },
  },
  {
    id: "crypto-client-history",
    description: "Prior Web3/crypto client history (natural cross-sell fit for a crypto card)",
    weight: 15,
    test: (d) => anySignal(d, (m) => Boolean(m.hasCryptoClientHistory)),
  },
  {
    id: "team-scale",
    description: "Team size estimate >= 10",
    weight: 10,
    test: (d) => anySignal(d, (m) => typeof m.teamSizeEstimate === "number" && m.teamSizeEstimate >= 10),
  },
  {
    id: "active-x-presence",
    description: "Agency has an active, self-describing presence on X (found via Twitter connector)",
    weight: 10,
    test: (d) => d.signals.some((s) => s.sourceConnector === "twitter-agency-signals"),
  },
  {
    id: "named-contact-found",
    description: "A named decision-maker was found via public sources",
    weight: 10,
    test: (d) => d.hasNamedContact,
  },
];
