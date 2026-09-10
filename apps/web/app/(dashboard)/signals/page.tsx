import Link from "next/link";
import { listSignals } from "../../../lib/data/signals";
import { Badge, FreshnessBadge } from "../../../components/ui/badge";
import { formatDate } from "../../../lib/utils";

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ signalType?: string }>;
}) {
  const params = await searchParams;
  const signals = await listSignals({ signalType: params.signalType });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Signals</h1>
        <p className="text-sm text-muted-foreground">{signals.length} buying signals across all leads</p>
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
                  No signals recorded yet.
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
    </div>
  );
}
