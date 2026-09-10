import Link from "next/link";
import { listSavedSearches } from "../../../lib/data/saved-searches";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { SavedSearchForm } from "../../../components/saved-search-form";
import { SavedSearchActions } from "../../../components/saved-search-actions";
import { formatDate } from "../../../lib/utils";
import {
  FILTER_LABELS,
  filtersToSearchParams,
  isFiltersEmpty,
  type StructuredSearchFilters,
} from "../../../lib/ai/search-filters";

function FilterChips({ filters }: { filters: StructuredSearchFilters }) {
  if (isFiltersEmpty(filters)) {
    return <span className="text-xs text-muted-foreground">No structured filters yet — re-interpret to add some.</span>;
  }

  const chips: string[] = [];
  for (const [key, label] of Object.entries(FILTER_LABELS) as [keyof StructuredSearchFilters, string][]) {
    const value = filters[key];
    if (Array.isArray(value)) {
      if (value.length > 0) chips.push(`${label}: ${value.join(", ")}`);
    } else if (value !== null) {
      chips.push(`${label}: ${String(value).replace(/_/g, " ")}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <Badge key={chip} variant="outline">
          {chip}
        </Badge>
      ))}
    </div>
  );
}

export default async function SavedSearchesPage() {
  const savedSearches = await listSavedSearches();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Saved searches</h1>
        <p className="text-sm text-muted-foreground">
          A natural-language query is interpreted into structured filters you can review, run against your existing
          leads, or promote into a discovery config for the workers pipeline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New saved search</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SavedSearchForm />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Vertical</th>
              <th className="px-3 py-2">Filters</th>
              <th className="px-3 py-2">Last run</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {savedSearches.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No saved searches yet.
                </td>
              </tr>
            ) : (
              savedSearches.map((s) => (
                <tr key={s.id} className="border-b border-border align-top last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.name}</div>
                    {s.query_text && <div className="text-xs text-muted-foreground">{s.query_text}</div>}
                    {!isFiltersEmpty(s.parsedFilters) && (
                      <Link
                        href={`/leads?savedSearch=${s.id}&${filtersToSearchParams(s.parsedFilters).toString()}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View matching leads →
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.vertical ? <Badge variant="outline">{s.vertical.replace(/_/g, " ")}</Badge> : "—"}
                  </td>
                  <td className="max-w-md px-3 py-2">
                    <FilterChips filters={s.parsedFilters} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(s.last_run_at)}</td>
                  <td className="px-3 py-2">
                    <SavedSearchActions
                      id={s.id}
                      queryText={s.query_text}
                      vertical={s.vertical}
                      hasFilters={!isFiltersEmpty(s.parsedFilters)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
