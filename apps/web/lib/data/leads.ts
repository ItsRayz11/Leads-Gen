import { createClient } from "../supabase/server";
import type { Freshness, LeadStatus, LeadTier, LeadVertical } from "@leads/db/types.js";
import { EMPTY_FILTERS, type StructuredSearchFilters } from "../ai/search-filters";
import {
  MAX_UNPAGED_ROWS,
  resolveSort,
  type LeadListRow,
  type SortDirection,
} from "../leads-table";

export type { LeadListRow };

export interface LeadFilters {
  status?: string;
  tier?: string;
  vertical?: string;
  q?: string;
  /** Structured filters from an interpreted natural-language search. */
  structured?: StructuredSearchFilters;
}

export interface LeadListOptions {
  /** A column key from LEAD_COLUMNS; anything unsortable falls back to score. */
  sort?: string;
  dir?: SortDirection;
  /** 1-based. Ignored when perPage is omitted. */
  page?: number;
  /**
   * Omit to read every match in one go (capped at MAX_UNPAGED_ROWS) — that is
   * what a saved-search run needs, since it counts matches rather than
   * displaying a page of them.
   */
  perPage?: number;
}

export interface LeadListResult {
  rows: LeadListRow[];
  /** Total matching rows in the database, not just the ones on this page. */
  total: number;
}

function companyRelation(inner: boolean): string {
  return `company:companies!leads_company_id_fkey${inner ? "!inner" : ""} ( id, name, country, industry, region, company_size )`;
}

function leadSelect(companyInner: boolean, signalInner: boolean): string {
  return `
    id, title, vertical, score, tier, status, priority, buying_signal_summary,
    service_type, freshness, verification_status, next_follow_up_at, created_at, updated_at,
    ${companyRelation(companyInner)},
    primary_contact:contacts!leads_primary_contact_id_fkey ( id, name, job_title )
    ${signalInner ? ", signals:lead_signals!inner ( signal_type )" : ""}
  `;
}

/**
 * PostgREST's `or=(...)` list is comma-separated, so a value containing a
 * comma, paren or star would break out of the filter. Values are quoted and
 * those characters stripped rather than escaped — a keyword is a search term,
 * not an expression, so dropping punctuation costs nothing.
 */
function sanitizeTerm(term: string): string {
  return term.replace(/["(),*]/g, " ").replace(/\s+/g, " ").trim();
}

function ilikeOrClause(columns: string[], terms: string[]): string | null {
  const clauses: string[] = [];
  for (const term of terms) {
    const safe = sanitizeTerm(term);
    if (!safe) continue;
    for (const column of columns) clauses.push(`${column}.ilike."%${safe}%"`);
  }
  return clauses.length > 0 ? clauses.join(",") : null;
}

export async function listLeads(
  filters: LeadFilters = {},
  options: LeadListOptions = {}
): Promise<LeadListResult> {
  const structured: StructuredSearchFilters = filters.structured ?? EMPTY_FILTERS;
  const companyInner =
    structured.industries.length > 0 ||
    structured.countries.length > 0 ||
    structured.regions.length > 0 ||
    structured.companySizes.length > 0;
  const signalInner = structured.signalTypes.length > 0;

  const sort = resolveSort(options.sort);
  const dir: SortDirection = options.dir ?? sort.defaultDir;

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select(leadSelect(companyInner, signalInner), { count: "exact" })
    // NULLS LAST in both directions: a lead with no follow-up date set is
    // "nothing scheduled", which belongs at the end either way.
    .order(sort.column, { ascending: dir === "asc", nullsFirst: false })
    // Ties on the sort column would otherwise be ordered arbitrarily, which
    // lets a row appear on two pages (or on none) as you page through.
    .order("id", { ascending: true });

  // Legacy single-value URL params (still used by the dashboard's quick links).
  if (filters.status) query = query.eq("status", filters.status as LeadStatus);
  if (filters.tier) query = query.eq("tier", filters.tier as LeadTier);
  if (filters.vertical) query = query.eq("vertical", filters.vertical as LeadVertical);
  if (filters.q) {
    // `title` is one of only 3 fixed per-vertical strings (see
    // VERTICAL_LEAD_TITLE), so it never contains a company name or keyword --
    // searching only that column made this box find almost nothing a user
    // actually typed. Also match the company's name (looked up separately,
    // since PostgREST can't OR a base-table and related-table column in one
    // clause) and the free-text fields that do carry real content.
    const safeQ = sanitizeTerm(filters.q);
    if (safeQ) {
      const { data: matchingCompanies } = await supabase
        .from("companies")
        .select("id")
        .ilike("name", `%${safeQ}%`);
      const companyIds = (matchingCompanies ?? []).map((c) => c.id);
      const clauses = [
        `title.ilike.%${safeQ}%`,
        `buying_signal_summary.ilike.%${safeQ}%`,
        `service_type.ilike.%${safeQ}%`,
      ];
      if (companyIds.length > 0) clauses.push(`company_id.in.(${companyIds.join(",")})`);
      query = query.or(clauses.join(","));
    }
  }

  if (structured.vertical) query = query.eq("vertical", structured.vertical as LeadVertical);
  if (structured.tiers.length > 0) query = query.in("tier", structured.tiers as LeadTier[]);
  if (structured.statuses.length > 0) query = query.in("status", structured.statuses as LeadStatus[]);
  if (structured.freshness.length > 0) query = query.in("freshness", structured.freshness as Freshness[]);
  if (structured.minScore !== null) query = query.gte("score", structured.minScore);

  // Keywords, role titles and service types all describe the same thing from
  // different angles ("what should this lead's text mention"), so a lead
  // matching ANY one of them is a candidate — requiring all three at once
  // (three separate ANDed .or() calls) made realistic multi-field searches
  // zero out even when good matches existed for some of the fields.
  const textSignalClause = ilikeOrClause(
    ["title", "buying_signal_summary", "qualification_summary", "service_type", "opportunity_type"],
    [...structured.keywords, ...structured.roleKeywords, ...structured.serviceTypes]
  );
  if (textSignalClause) query = query.or(textSignalClause);

  // Exclusions only run against `title`, which is NOT NULL. Applying a
  // NOT ILIKE to a nullable column would drop every row where it is null,
  // silently hiding leads that don't mention the excluded term at all.
  for (const term of structured.excludeKeywords) {
    const safe = sanitizeTerm(term);
    if (safe) query = query.not("title", "ilike", `%${safe}%`);
  }

  const companyClauses: [string, string[]][] = [
    ["industry", structured.industries],
    ["country", structured.countries],
    ["region", structured.regions],
    ["company_size", structured.companySizes],
  ];
  for (const [column, terms] of companyClauses) {
    const clause = ilikeOrClause([column], terms);
    if (clause) query = query.or(clause, { referencedTable: "company" });
  }

  if (signalInner) {
    const clause = ilikeOrClause(["signal_type"], structured.signalTypes);
    if (clause) query = query.or(clause, { referencedTable: "signals" });
  }

  if (options.perPage) {
    const page = Math.max(1, options.page ?? 1);
    const from = (page - 1) * options.perPage;
    query = query.range(from, from + options.perPage - 1);
  } else {
    query = query.limit(MAX_UNPAGED_ROWS);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as LeadListRow[];
  return { rows, total: count ?? rows.length };
}

export async function getLeadDetail(id: string) {
  const supabase = await createClient();

  const [
    leadRes,
    signalsRes,
    evidenceRes,
    scoresRes,
    activitiesRes,
    outreachRes,
    tasksRes,
    notesRes,
    contactsRes,
    tagsRes,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "*, company:companies!leads_company_id_fkey(*), primary_contact:contacts!leads_primary_contact_id_fkey(*)"
      )
      .eq("id", id)
      .single(),
    supabase.from("lead_signals").select("*").eq("lead_id", id).order("signal_date", { ascending: false }),
    supabase.from("evidence").select("*").eq("lead_id", id).order("discovered_at", { ascending: false }),
    supabase.from("lead_scores").select("*").eq("lead_id", id).order("computed_at", { ascending: false }).limit(1),
    supabase.from("activities").select("*").eq("lead_id", id).order("occurred_at", { ascending: false }),
    supabase.from("outreach").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").eq("lead_id", id).order("due_date", { ascending: true }),
    supabase.from("notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("contacts").select("*"),
    supabase.from("lead_tags").select("tag:tags(id, name, color)").eq("lead_id", id),
  ]);

  if (leadRes.error) throw leadRes.error;

  const lead = leadRes.data as any;
  const companyContacts = lead?.company_id
    ? (contactsRes.data ?? []).filter((c) => c.company_id === lead.company_id)
    : [];

  return {
    lead,
    signals: signalsRes.data ?? [],
    evidence: evidenceRes.data ?? [],
    latestScore: scoresRes.data?.[0] ?? null,
    activities: activitiesRes.data ?? [],
    outreach: outreachRes.data ?? [],
    tasks: tasksRes.data ?? [],
    notes: notesRes.data ?? [],
    companyContacts,
    tags: (tagsRes.data ?? []).map((t: any) => t.tag).filter(Boolean),
  };
}
