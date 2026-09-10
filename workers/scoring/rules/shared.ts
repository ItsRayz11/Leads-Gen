import type { LeadDraft, ScoreRule } from "../score.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when any of the lead's signals carries the meta the predicate wants. */
export function anySignal(
  draft: LeadDraft,
  predicate: (meta: Record<string, unknown>) => boolean
): boolean {
  return draft.signals.some((s) => predicate(s.meta ?? {}));
}

/** The largest numeric value of a meta key across the signals, or 0. */
export function maxMetaNumber(draft: LeadDraft, key: string): number {
  return draft.signals.reduce((max, signal) => {
    const value = signal.meta?.[key];
    return typeof value === "number" ? Math.max(max, value) : max;
  }, 0);
}

/**
 * The newest posting date across the signals.
 *
 * Accepts a string or epoch number as well as a Date on purpose: a draft
 * rebuilt from `lead_signals.raw_payload` has been through JSON, so a date a
 * connector set as a Date arrives back as a string. An `instanceof Date`
 * check alone meant every re-scored lead read as having no date at all.
 */
export function newestPostedAt(draft: LeadDraft): Date | null {
  let newest: Date | null = null;
  for (const signal of draft.signals) {
    const raw = signal.meta?.postedAt;
    let parsed: Date | null = null;
    if (raw instanceof Date) parsed = raw;
    else if (typeof raw === "string" || typeof raw === "number") {
      const candidate = new Date(raw);
      if (!Number.isNaN(candidate.getTime())) parsed = candidate;
    }
    if (parsed && (!newest || parsed > newest)) newest = parsed;
  }
  return newest;
}

/**
 * Full credit until `fullWithinDays`, then straight-line decay to nothing at
 * `zeroAtDays`. Returns false when there is no date to judge, so the rule
 * counts as unmatched rather than as a zero-freshness lead.
 */
export function recencyCredit(
  draft: LeadDraft,
  fullWithinDays: number,
  zeroAtDays: number
): number | false {
  const postedAt = newestPostedAt(draft);
  if (!postedAt) return false;

  const ageDays = (Date.now() - postedAt.getTime()) / DAY_MS;
  if (ageDays <= fullWithinDays) return 1;
  if (ageDays >= zeroAtDays) return false;
  return 1 - (ageDays - fullWithinDays) / (zeroAtDays - fullWithinDays);
}

/**
 * The evidence dimension, which every vertical scores the same way: is there
 * a public URL backing this up, and did more than one source find the company
 * independently.
 *
 * Both tests read fields that survive persistence — `evidenceUrl` and
 * `sourceConnector` — so they hold whether the draft came straight from a
 * connector or was rebuilt from the database.
 */
export function evidenceRules(options: {
  linkWeight: number;
  corroborationWeight: number;
  corroborationCap: number;
}): ScoreRule[] {
  return [
    {
      id: "has-evidence-link",
      description: "A signal cites a public URL as evidence",
      dimension: "evidence",
      weight: options.linkWeight,
      test: (d) => d.signals.some((s) => Boolean(s.evidenceUrl)),
    },
    {
      id: "multi-source-corroboration",
      description: "More than one source found this company independently",
      dimension: "evidence",
      weight: options.corroborationWeight,
      cap: options.corroborationCap,
      test: (d) => Math.max(0, new Set(d.signals.map((s) => s.sourceConnector)).size - 1),
    },
  ];
}

/** The contactability dimension — one rule, shared by every vertical. */
export function namedContactRule(weight: number): ScoreRule {
  return {
    id: "named-contact-found",
    description: "A named decision-maker was found via public sources",
    dimension: "contactability",
    weight,
    test: (d) => d.hasNamedContact,
  };
}
