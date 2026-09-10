import Link from "next/link";
import { listSignals } from "../../../lib/data/signals";
import { Badge, FreshnessBadge } from "../../../components/ui/badge";
import { formatDate } from "../../../lib/utils";
import { Pager } from "../../../components/ui/pager";
import { queryString, resolvePage, resolvePerPage, single, type SearchParams } from "../../../lib/paging";

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const signalType = single(params, "signalType");
  const page = resolvePage(single(params, "page"));
  const perPage = resolvePerPage(single(params, "perPage"));

  const { rows: signals, total } = await listSignals({ signalType }, { page, perPage });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Signals</h1>
        <p className="text-sm text-muted-foreground">
          {total} buying signal{total === 1 ? "" : "s"}
          {signalType ? ` of type "${signalType}"` : " across all leads"}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Company / Lead</th>
              <th className="px-3 py-2">Signal type</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Strength</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Freshness</th>
              <th className="px-3 py-2">Verification</th>
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {signalType ? "No signals of that type." : "No signals recorded yet."}
                </td>
              </tr>
            ) : (
              signals.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/leads/${s.lead_id}`} className="font-medium hover:text-primary">
                      {s.lead?.company?.name ?? "Unknown"}
                    </Link>
                    {s.lead?.title && <div className="text-xs text-muted-foreground">{s.lead.title}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{s.signal_type.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="max-w-md px-3 py-2 text-muted-foreground">{s.signal_description}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.signal_strength ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(s.signal_date)}</td>
                  <td className="px-3 py-2">
                    <FreshnessBadge freshness={s.freshness} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.verification_status.replace(/_/g, " ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        basePath="/signals"
        searchParams={queryString(params)}
        page={page}
        perPage={perPage}
        total={total}
        rowsOnPage={signals.length}
        noun={{ one: "signal", many: "signals" }}
      />
    </div>
  );
}
