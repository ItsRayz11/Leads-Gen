/**
 * Column, sort and paging definitions for the /leads table.
 *
 * Deliberately free of any server-only import: the server page reads it to
 * build the query, and the client table component reads the same list to
 * render headers and the column picker, so "what a column is called" and
 * "what it sorts on" are defined once.
 */

export interface LeadListRow {
  id: string;
  title: string;
  vertical: string;
  score: number;
  tier: string | null;
  status: string;
  priority: string | null;
  buying_signal_summary: string | null;
  service_type: string | null;
  freshness: string | null;
  verification_status: string;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  company: {
    id: string;
    name: string;
    country: string | null;
    industry: string | null;
    region: string | null;
    company_size: string | null;
  } | null;
  primary_contact: { id: string; name: string | null; job_title: string | null } | null;
}

export type SortDirection = "asc" | "desc";

export interface LeadColumn {
  /** Stable id — used in the `sort` URL param and in the saved column layout. */
  key: string;
  label: string;
  /**
   * Column on `leads` to ORDER BY. Absent means the column can't be sorted:
   * company, contact and country live on an embedded table, and PostgREST
   * can't order a parent row by an embedded resource's column.
   *
   * The `*_rank` columns are the generated sort ranks from migration 0002 —
   * ordering on `tier`/`status`/`freshness` directly would be alphabetical,
   * which means nothing to a reader.
   */
  sortColumn?: string;
  /** Direction applied the first time this header is clicked. */
  defaultDir?: SortDirection;
  defaultVisible: boolean;
  /** Right-aligns the cell; used for the numeric score. */
  numeric?: boolean;
}

export const LEAD_COLUMNS: LeadColumn[] = [
  { key: "company", label: "Company", defaultVisible: true },
  { key: "contact", label: "Contact", defaultVisible: true },
  { key: "title", label: "Lead", sortColumn: "title", defaultDir: "asc", defaultVisible: false },
  { key: "vertical", label: "Vertical", sortColumn: "vertical", defaultDir: "asc", defaultVisible: false },
  { key: "score", label: "Score", sortColumn: "score", defaultDir: "desc", defaultVisible: true, numeric: true },
  { key: "tier", label: "Tier", sortColumn: "tier_rank", defaultDir: "asc", defaultVisible: true },
  { key: "priority", label: "Priority", sortColumn: "priority_rank", defaultDir: "asc", defaultVisible: false },
  { key: "signal", label: "Signal", sortColumn: "buying_signal_summary", defaultDir: "asc", defaultVisible: true },
  { key: "service", label: "Service", sortColumn: "service_type", defaultDir: "asc", defaultVisible: true },
  { key: "country", label: "Country", defaultVisible: true },
  { key: "status", label: "Status", sortColumn: "status_rank", defaultDir: "asc", defaultVisible: true },
  { key: "verification", label: "Verification", sortColumn: "verification_rank", defaultDir: "asc", defaultVisible: true },
  { key: "followUp", label: "Follow-up", sortColumn: "next_follow_up_at", defaultDir: "asc", defaultVisible: true },
  { key: "freshness", label: "Freshness", sortColumn: "freshness_rank", defaultDir: "asc", defaultVisible: true },
  { key: "created", label: "Created", sortColumn: "created_at", defaultDir: "desc", defaultVisible: false },
  { key: "updated", label: "Updated", sortColumn: "updated_at", defaultDir: "desc", defaultVisible: true },
];

export const DEFAULT_SORT_KEY = "score";
export const DEFAULT_SORT_DIR: SortDirection = "desc";

export const PAGE_SIZES = [25, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 50;

/** Ceiling on an unpaginated read (saved-search runs), so one query can't pull the whole table. */
export const MAX_UNPAGED_ROWS = 5000;

const COLUMN_BY_KEY = new Map(LEAD_COLUMNS.map((column) => [column.key, column]));

export function leadColumn(key: string): LeadColumn | undefined {
  return COLUMN_BY_KEY.get(key);
}

/**
 * Resolves a `sort` URL param to a column that can actually be ordered on.
 * An unknown or unsortable key falls back to the default rather than
 * erroring — a stale bookmark should still open the list.
 */
export function resolveSort(key: string | undefined): { key: string; column: string; defaultDir: SortDirection } {
  const column = key ? COLUMN_BY_KEY.get(key) : undefined;
  if (column?.sortColumn) {
    return { key: column.key, column: column.sortColumn, defaultDir: column.defaultDir ?? DEFAULT_SORT_DIR };
  }
  const fallback = COLUMN_BY_KEY.get(DEFAULT_SORT_KEY)!;
  return { key: fallback.key, column: fallback.sortColumn!, defaultDir: DEFAULT_SORT_DIR };
}

export function resolveDir(dir: string | undefined, fallback: SortDirection): SortDirection {
  return dir === "asc" || dir === "desc" ? dir : fallback;
}

export function resolvePerPage(value: string | undefined): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return (PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

export function resolvePage(value: string | undefined): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

const DEFAULT_VISIBLE = LEAD_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

export function defaultColumnVisibility(): Record<string, boolean> {
  return Object.fromEntries(LEAD_COLUMNS.map((c) => [c.key, c.defaultVisible]));
}

/**
 * Merges a saved column layout with the current column list, so a layout
 * saved before a column existed still shows that column at its default
 * instead of hiding it silently.
 */
export function mergeColumnVisibility(saved: unknown): Record<string, boolean> {
  const visibility = defaultColumnVisibility();
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return visibility;
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    if (key in visibility && typeof value === "boolean") visibility[key] = value;
  }
  // A layout with nothing visible would render an empty table with no way
  // back, so an all-off layout falls back to the defaults.
  if (!Object.values(visibility).some(Boolean)) {
    for (const key of DEFAULT_VISIBLE) visibility[key] = true;
  }
  return visibility;
}

export const COLUMN_LAYOUT_STORAGE_KEY = "leads.columns.v1";
