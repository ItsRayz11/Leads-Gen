import type { Database } from "@leads/db/types.js";

type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

/**
 * Columns a human is allowed to edit directly. Everything else on `leads`
 * (ids, timestamps, vertical_data) is owned by the pipeline, so an unknown
 * key in a request body is dropped rather than written.
 */
export const EDITABLE_FIELDS = [
  "title",
  "vertical",
  "opportunity_type",
  "service_type",
  "score",
  "tier",
  "status",
  "priority",
  "buying_signal_summary",
  "signal_strength",
  "signal_date",
  "freshness",
  "verification_status",
  "recommended_offer",
  "qualification_summary",
  "owner",
  "source_type",
  "next_follow_up_at",
  "primary_contact_id",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** Columns where an empty string means "cleared", not the literal "". */
export const NULLABLE_FIELDS = new Set<EditableField>([
  "opportunity_type",
  "service_type",
  "tier",
  "buying_signal_summary",
  "signal_strength",
  "signal_date",
  "freshness",
  "recommended_offer",
  "qualification_summary",
  "owner",
  "source_type",
  "next_follow_up_at",
  "primary_contact_id",
]);

/**
 * The subset of editable fields a *bulk* edit may set. Narrower than the
 * single-lead form on purpose: `title` is half of the (company_id, title)
 * unique index so writing one value across many leads would collide, and
 * `score` is the scorer's output — overwriting it wholesale would silently
 * detach every one of those leads from its score breakdown.
 */
export const BULK_EDITABLE_FIELDS = new Set<EditableField>([
  "status",
  "tier",
  "priority",
  "verification_status",
  "owner",
  "next_follow_up_at",
  "freshness",
  "service_type",
]);

/**
 * Turns an arbitrary request body into a safe `leads` update. `allowed`
 * restricts which of the editable fields this particular caller may touch.
 */
export function buildLeadPatch(
  body: Record<string, unknown>,
  allowed: ReadonlySet<EditableField> | null = null
): LeadUpdate {
  const patch: Record<string, unknown> = {};

  for (const field of EDITABLE_FIELDS) {
    if (allowed && !allowed.has(field)) continue;
    if (!(field in body)) continue;
    const value = body[field];

    if (field === "score") {
      const score = typeof value === "string" ? parseInt(value, 10) : value;
      if (typeof score === "number" && Number.isFinite(score)) {
        patch.score = Math.max(0, Math.min(100, Math.round(score)));
      }
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed && NULLABLE_FIELDS.has(field)) {
        patch[field] = null;
        continue;
      }
      if (!trimmed) continue; // NOT NULL column — ignore a blanked value
      patch[field] = trimmed;
      continue;
    }

    if (value === null && NULLABLE_FIELDS.has(field)) {
      patch[field] = null;
      continue;
    }

    if (value !== undefined) patch[field] = value;
  }

  return patch as LeadUpdate;
}

export type { LeadUpdate };
