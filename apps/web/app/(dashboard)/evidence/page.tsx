import Link from "next/link";
import { listEvidence } from "../../../lib/data/evidence";
import { FreshnessBadge } from "../../../components/ui/badge";
import { formatDate } from "../../../lib/utils";
import { Pager } from "../../../components/ui/pager";
import { queryString, resolvePage, resolvePerPage, single, type SearchParams } from "../../../lib/paging";

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = resolvePage(single(params, "page"));
  const perPage = resolvePerPage(single(params, "perPage"));

  const { rows: evidence, total } = await listEvidence({ page, perPage });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Evidence</h1>
        <p className="text-sm text-muted-foreground">
          {total} evidence record{total === 1 ? "" : "s"} across all leads
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Company / Lead</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Discovered</th>
              <th className="px-3 py-2">Freshness</th>
              <th className="px-3 py-2">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {evidence.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No evidence recorded yet.
                </td>
              </tr>
            ) : (
              evidence.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/leads/${e.lead_id}`} className="font-medium hover:text-primary">
                      {e.lead?.company?.name ?? "Unknown"}
                    </Link>
                    {e.lead?.title && <div className="text-xs text-muted-foreground">{e.lead.title}</div>}
                  </td>
                  <td className="max-w-md px-3 py-2 text-muted-foreground">{e.description}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.source}</td>
                  <td className="px-3 py-2">
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {e.source_title ?? "Link"}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(e.published_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(e.discovered_at)}</td>
                  <td className="px-3 py-2">
                    <FreshnessBadge freshness={e.freshness} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        basePath="/evidence"
        searchParams={queryString(params)}
        page={page}
        perPage={perPage}
        total={total}
        rowsOnPage={evidence.length}
        noun={{ one: "evidence record", many: "evidence records" }}
      />
    </div>
  );
}
