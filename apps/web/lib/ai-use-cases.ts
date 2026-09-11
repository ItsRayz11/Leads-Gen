/**
 * The AI use-case vocabulary, with no server-only imports.
 *
 * These constants are needed by both server components (Settings page) and
 * client components (the task-routing form). They used to live in
 * lib/data/ai-settings.ts, which imports `next/headers` via the Supabase
 * server client — importing a *value* from there into a client component
 * fails the build outright, so the shared vocabulary lives here and
 * ai-settings.ts re-exports it for existing server-side callers.
 */

/** The three use cases this app actually calls generateText() for — see lib/ai/client.ts. */
export const AI_USE_CASES = ["search_interpretation", "lead_qualification", "outreach_drafting"] as const;
export type AiUseCase = (typeof AI_USE_CASES)[number];

export const AI_USE_CASE_LABELS: Record<AiUseCase, string> = {
  search_interpretation: "Search interpretation",
  lead_qualification: "Lead qualification",
  outreach_drafting: "Outreach drafting",
};

/**
 * What actually happens when a use case has no provider assigned. Only
 * search interpretation degrades into something useful — the endpoint parses
 * the query deterministically and labels the result "Keyword fallback". The
 * other two have nothing to fall back *to*: their buttons return an honest
 * error rather than a draft or an assessment, because inventing either would
 * mean fabricating facts about a real company.
 */
export const AI_USE_CASE_UNASSIGNED_BEHAVIOUR: Record<AiUseCase, string> = {
  search_interpretation: "Not assigned — falls back to keyword parsing",
  lead_qualification: "Not assigned — “Assess with AI” will report that no provider is configured",
  outreach_drafting: "Not assigned — “Generate with AI” will report that no provider is configured",
};
