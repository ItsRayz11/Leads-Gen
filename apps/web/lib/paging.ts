/**
 * URL-driven paging, shared by every list page.
 *
 * Deliberately free of any server-only import: a server page reads it to turn
 * `?page=&perPage=` into a Postgres range, and the client <Pager> reads the
 * same constants to render the controls, so page size is defined once.
 *
 * Paging lives in the URL rather than in component state for the same reason
 * the /leads sort does — a given page of a filtered list stays a shareable
 * link, and the slicing happens in Postgres instead of by fetching everything
 * and discarding most of it.
 */

export const PAGE_SIZES = [25, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 50;

/** Ceiling on an unpaginated read (saved-search runs), so one query can't pull the whole table. */
export const MAX_UNPAGED_ROWS = 5000;

export interface PageOptions {
  page?: number;
  perPage?: number;
}

/** What a paged list query returns: this page's rows, and the full match count. */
export interface PagedResult<T> {
  rows: T[];
  total: number;
}

export type SearchParams = Record<string, string | string[] | undefined>;

/** Next hands a repeated query param as an array; list pages only ever want one. */
export function single(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Re-serializes the current params so pager links preserve unrelated filters. */
export function queryString(params: SearchParams): string {
  const entries = Object.entries(params).flatMap(([key, value]) => {
    const first = Array.isArray(value) ? value[0] : value;
    return first === undefined ? [] : [[key, first] as [string, string]];
  });
  return new URLSearchParams(entries).toString();
}

/** An unrecognized size falls back to the default rather than erroring. */
export function resolvePerPage(value: string | undefined): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return (PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

export function resolvePage(value: string | undefined): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Inclusive row bounds for `.range()`, which is what PostgREST expects. */
export function pageRange(page: number, perPage: number): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * perPage;
  return { from, to: from + perPage - 1 };
}

/** Resolves paging options to a range, defaulting anything the caller left out. */
export function rangeFor(options: PageOptions = {}): { from: number; to: number } {
  return pageRange(options.page ?? 1, options.perPage ?? DEFAULT_PAGE_SIZE);
}
