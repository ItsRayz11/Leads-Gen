import type { ScoreRule } from "../score.js";
import { anySignal, evidenceRules, maxMetaNumber, namedContactRule } from "./shared.js";

/**
 * No directory/rating data is available for free (Clutch/DesignRush have no
 * public API), so this leans entirely on self-reported signals from the
 * agency's own site/Twitter: disclosed spend, channel breadth, prior
 * Web3/crypto client work (cross-sell fit for a crypto card), and scale.
 *
 * Fit carries the most weight here. An agency that already runs paid campaigns
 * for crypto clients is the whole thesis of the Bitget Card pitch, and that is
 * a property of the agency rather than a moment in time — which is also why
 * this vertical has no freshness rules and its dimension weights omit it.
 */
export const vertical3CardAffiliateRules: ScoreRule[] = [
  // ---- fit: does this agency's book of business match the card pitch ----
  {
    id: "crypto-client-history",
    description: "Prior Web3/crypto client history (natural cross-sell fit for a crypto card)",
    dimension: "fit",
    weight: 15,
    test: (d) => anySignal(d, (m) => Boolean(m.hasCryptoClientHistory)),
  },
  {
    id: "multi-channel",
    description: "Manages multiple paid channels (Meta + Google + TikTok, etc.)",
    dimension: "fit",
    weight: 15,
    test: (d) => maxMetaNumber(d, "channelsCount") >= 2,
  },

  // ---- intent: has it put a spend figure in public ----
  {
    id: "ad-spend-disclosed",
    description: "Agency's own site discloses a specific ad-spend figure",
    dimension: "intent",
    weight: 20,
    test: (d) => anySignal(d, (m) => Boolean(m.adSpendMentioned)),
  },

  // ---- companyQuality: is the spend and the team big enough to matter ----
  {
    id: "high-ad-spend",
    description: "Disclosed ad spend is >= $1M",
    dimension: "companyQuality",
    weight: 15,
    test: (d) => anySignal(d, (m) => typeof m.adSpendUsd === "number" && m.adSpendUsd >= 1_000_000),
  },
  {
    id: "team-scale",
    description: "Team size estimate >= 10",
    dimension: "companyQuality",
    weight: 10,
    test: (d) => anySignal(d, (m) => typeof m.teamSizeEstimate === "number" && m.teamSizeEstimate >= 10),
  },

  // ---- evidence: an agency describing itself on X is the source here ----
  {
    id: "active-x-presence",
    description: "Agency has an active, self-describing presence on X (found via Twitter connector)",
    dimension: "evidence",
    weight: 10,
    test: (d) => d.signals.some((s) => s.sourceConnector === "twitter-agency-signals"),
  },
  ...evidenceRules({ linkWeight: 10, corroborationWeight: 5, corroborationCap: 10 }),

  // ---- contactability ----
  namedContactRule(10),
];
