import Link from "next/link";
import { listLeads } from "../../../lib/data/leads";
import { getSavedSearch } from "../../../lib/data/saved-searches";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { LeadsTable } from "../../../components/leads/leads-table";
import { resolveDir, resolvePage, resolvePerPage, resolveSort } from "../../../lib/leads-table";
import { describeFilters, filtersFromSearchParams, isFiltersEmpty } from "../../../lib/ai/search-filters";

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Sort, page size and quick filters all live in the URL rather than in
 * component state: a filtered, sorted list stays a shareable link, and the
 * query runs in Postgres instead of re-sorting one page in the browser.
 */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const structured = filtersFromSearchParams(params);
  const savedSearchId = single(params, "savedSearch");

  const sort = resolveSort(single(params, "sort"));
  const dir = resolveDir(single(params, "dir"), sort.defaultDir);
  const perPage = resolvePerPage(single(params, "perPage"));
  const page = resolvePage(single(params, "page"));

  const quickFilters = {
    q: single(params, "q") ?? "",
    status: single(params, "status") ?? "",
    tier: single(params, "tier") ?? "",
    vertical: single(params, "vertical") ?? "",
  };

  const [{ rows, total }, savedSearch] = await Promise.all([
    listLeads(
      {
        status: quickFilters.status || undefined,
        tier: quickFilters.tier || undefined,
        q: quickFilters.q || undefined,
        structured,
      },
      { sort: sort.key, dir, page, perPage }
    ),
    savedSearchId ? getSavedSearch(savedSearchId) : Promise.resolve(null),
  ]);

  const hasStructured = !isFiltersEmpty(structured);
  const hasQuickFilter = Boolean(
    quickFilters.q || quickFilters.status || quickFilters.tier || quickFilters.vertical
  );
  const filtered = hasStructured || hasQuickFilter;
  const exportVertical = structured.vertical ?? quickFilters.vertical;

  // Only the structured filters and the saved search are echoed back here;
  // the quick filters have their own visible controls in the toolbar.
  const searchParamsString = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value] as [string, string]]
    )
  ).toString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">All Leads</h1>
          <p className="text-sm text-muted-foreground">
            {total} lead{total === 1 ? "" : "s"} match
            {filtered ? " these filters" : " — everything on file"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/leads/new">
            <Button size="sm">New lead</Button>
          </Link>
          <Link href={`/export${exportVertical ? `?vertical=${exportVertical}` : ""}`}>
            <Button variant="secondary" size="sm">
              Export CSV
            </Button>
          </Link>
        </div>
      </div>

      {(hasStructured || savedSearch) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          {savedSearch && <Badge variant="primary">Saved search: {savedSearch.name}</Badge>}
          <span className="text-muted-foreground">{describeFilters(structured)}</span>
          <Link href="/leads" className="ml-auto text-primary hover:underline">
            Clear filters
          </Link>
        </div>
      )}

      <LeadsTable
        rows={rows}
        total={total}
        page={page}
        perPage={perPage}
        sort={sort.key}
        dir={dir}
        searchParams={searchParamsString}
        quickFilters={quickFilters}
        emptyMessage={
          filtered
            ? "No leads match these filters."
            : "No leads yet. Add one by hand, run a discovery pipeline, or import a CSV."
        }
      />
    </div>
  );
}
