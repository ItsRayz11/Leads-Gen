import type { ScoreRule } from "../score.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function anySignal(draft: Parameters<ScoreRule["test"]>[0], pred: (meta: Record<string, unknown>) => boolean) {
  return draft.signals.some((s) => pred(s.meta ?? {}));
}

/**
 * Mirrors how leads were triaged manually in the legacy CSV: rate/hours
 * disclosed, urgency language, a cluster of related openings ("Refounding"
 * signal), and a named contact all pushed a lead toward A/A+.
 */
export const vertical1HiringRules: ScoreRule[] = [
  {
    id: "rate-disclosed",
    description: "Hourly rate or salary is disclosed in the posting",
    weight: 15,
    test: (d) => anySignal(d, (m) => Boolean(m.rateDisclosed)),
  },
  {
    id: "rate-above-threshold",
    description: "Disclosed rate is >= $50/hr or >= $80k/yr",
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
    description: 'Posting uses urgency language ("immediate", "ASAP", "urgent")',
    weight: 10,
    test: (d) =>
      d.signals.some((s) => /\b(immediate|asap|urgent(ly)?)\b/i.test(s.signalText)),
  },
  {
    id: "multi-role-cluster",
    description: "Multiple related social/community/marketing roles open at the same company",
    weight: 10,
    cap: 30,
    test: (d) => {
      const roleCount = d.signals.reduce((max, s) => {
        const n = typeof s.meta?.openRolesAtCompany === "number" ? s.meta.openRolesAtCompany : 1;
        return Math.max(max, n);
      }, 1);
      return Math.max(0, roleCount - 1); // extra roles beyond the first
    },
  },
  {
    id: "full-time-30plus",
    description: "Role is full-time or 30+ hours/week",
    weight: 10,
    test: (d) =>
      anySignal(
        d,
        (m) =>
          m.employmentType === "full_time" ||
          (typeof m.hoursPerWeek === "number" && m.hoursPerWeek >= 30)
      ),
  },
  {
    id: "funding-signal",
    description: "Company shows a funding/treasury signal (raised round, VC-backed, large treasury)",
    weight: 15,
    test: (d) => anySignal(d, (m) => Boolean(m.fundingSignal)),
  },
  {
    id: "posted-recently",
    description: "Posting is recent (full credit within 14 days, decaying to 0 by day 60)",
    weight: 10,
    test: (d) => {
      const postedAt = d.signals
        .map((s) => (s.meta?.postedAt instanceof Date ? s.meta.postedAt : null))
        .find((v): v is Date => v != null);
      if (!postedAt) return false;
      const ageDays = (Date.now() - postedAt.getTime()) / DAY_MS;
      if (ageDays <= 14) return 1;
      if (ageDays >= 60) return false;
      // linear decay between day 14 and day 60 -> fraction of full weight
      return 1 - (ageDays - 14) / (60 - 14);
    },
  },
  {
    id: "named-contact-found",
    description: "A named decision-maker was found via public sources",
    weight: 10,
    test: (d) => d.hasNamedContact,
  },
  {
    id: "multi-account-scope",
    description: "Role requires managing 3+ social accounts",
    weight: 10,
    test: (d) => anySignal(d, (m) => typeof m.accountsManaged === "number" && m.accountsManaged >= 3),
  },
];
