import type { ScoreRule } from "../score.js";
import {
  anySignal,
  evidenceRules,
  maxMetaNumber,
  namedContactRule,
  recencyCredit,
} from "./shared.js";

/**
 * Mirrors how leads were triaged manually in the legacy CSV: rate/hours
 * disclosed, urgency language, a cluster of related openings, and a named
 * contact all pushed a lead toward A/A+.
 *
 * Now split across dimensions so the reason is legible. A disclosed rate and
 * urgent wording are *intent* — someone has budget and is asking now. Several
 * open roles and a funding signal are *company quality* — evidence of a team
 * being built rather than of this particular hire. Keeping them apart is what
 * stops "three open roles" from reading like "ready to buy".
 */
export const vertical1HiringRules: ScoreRule[] = [
  // ---- intent: is someone asking for this work, with budget, right now ----
  {
    id: "rate-disclosed",
    description: "Hourly rate or salary is disclosed in the posting",
    dimension: "intent",
    weight: 15,
    test: (d) => anySignal(d, (m) => Boolean(m.rateDisclosed)),
  },
  {
    id: "rate-above-threshold",
    description: "Disclosed rate is >= $50/hr or >= $80k/yr",
    dimension: "intent",
    weight: 10,
    test: (d) =>
      anySignal(
        d,
        (m) =>
          (typeof m.hourlyRate === "number" && m.hourlyRate >= 50) ||
          (typeof m.annualSalary === "number" && m.annualSalary >= 80_000)
      ),
  },
  {
    id: "urgency-language",
    description: 'Posting uses urgency language ("immediately", "ASAP", "urgent")',
    dimension: "intent",
    weight: 10,
    // "immediate" needs the optional suffix too: the earlier pattern matched
    // "urgently" but not "immediately", which is the commoner phrasing.
    test: (d) =>
      d.signals.some((s) => /\b(immediate(ly)?|asap|urgent(ly)?)\b/i.test(s.signalText)),
  },

  // ---- fit: does the work match the services on offer ----
  {
    id: "multi-account-scope",
    description: "Role requires managing 3+ social accounts",
    dimension: "fit",
    weight: 10,
    test: (d) => anySignal(d, (m) => typeof m.accountsManaged === "number" && m.accountsManaged >= 3),
  },

  // ---- companyQuality: is there a real, funded team behind the post ----
  {
    id: "funding-signal",
    description: "Company shows a funding/treasury signal (raised round, VC-backed, large treasury)",
    dimension: "companyQuality",
    weight: 15,
    test: (d) => anySignal(d, (m) => Boolean(m.fundingSignal)),
  },
  {
    id: "multi-role-cluster",
    description: "Multiple related social/community/marketing roles open at the same company",
    dimension: "companyQuality",
    weight: 10,
    cap: 30,
    test: (d) => Math.max(0, Math.max(1, maxMetaNumber(d, "openRolesAtCompany")) - 1),
  },
  {
    id: "full-time-30plus",
    description: "Role is full-time or 30+ hours/week",
    dimension: "companyQuality",
    weight: 10,
    test: (d) =>
      anySignal(
        d,
        (m) =>
          m.employmentType === "full_time" ||
          (typeof m.hoursPerWeek === "number" && m.hoursPerWeek >= 30)
      ),
  },

  // ---- freshness: a filled role is not an opportunity ----
  {
    id: "posted-recently",
    description: "Posting is recent (full credit within 14 days, decaying to 0 by day 60)",
    dimension: "freshness",
    weight: 10,
    test: (d) => recencyCredit(d, 14, 60),
  },

  // ---- contactability + evidence ----
  namedContactRule(10),
  ...evidenceRules({ linkWeight: 10, corroborationWeight: 5, corroborationCap: 10 }),
];
