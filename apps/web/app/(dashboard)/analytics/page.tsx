import {
  getAnalytics,
  type CountBucket,
  type ReplyStat,
  type SegmentWinRate,
} from "../../../lib/data/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";

function pct(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

function BarList({ buckets, total }: { buckets: CountBucket[]; total: number }) {
  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }
  return (
    <div className="space-y-2">
      {buckets.map((b) => {
        const width = total > 0 ? Math.round((b.count / total) * 100) : 0;
        return (
          <div key={b.label} className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0 truncate text-muted-foreground">{b.label.replace(/_/g, " ")}</span>
            <div className="h-2 flex-1 rounded-full bg-primary/20">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-muted-foreground">{b.count}</span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ReplyTable({ rows, firstColumn }: { rows: ReplyStat[]; firstColumn: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No recorded outreach yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="py-1 pr-2">{firstColumn}</th>
            <th className="py-1 pr-2 text-right">Sent</th>
            <th className="py-1 pr-2 text-right">Replied</th>
            <th className="py-1 text-right">Reply rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/50 last:border-0">
              <td className="py-1 pr-2">{row.label.replace(/_/g, " ")}</td>
              <td className="py-1 pr-2 text-right text-muted-foreground">{row.sent}</td>
              <td className="py-1 pr-2 text-right text-muted-foreground">{row.replied}</td>
              <td className="py-1 text-right font-medium">{pct(row.replyRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SegmentTable({ rows, firstColumn }: { rows: SegmentWinRate[]; firstColumn: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="py-1 pr-2">{firstColumn}</th>
            <th className="py-1 pr-2 text-right">Won</th>
            <th className="py-1 pr-2 text-right">Lost</th>
            <th className="py-1 pr-2 text-right">Open</th>
            <th className="py-1 text-right">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/50 last:border-0">
              <td className="py-1 pr-2">{row.label.replace(/_/g, " ")}</td>
              <td className="py-1 pr-2 text-right text-success">{row.won}</td>
              <td className="py-1 pr-2 text-right text-destructive">{row.lost}</td>
              <td className="py-1 pr-2 text-right text-muted-foreground">{row.open}</td>
              <td className="py-1 text-right font-medium">{pct(row.winRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AnalyticsPage() {
  const analytics = await getAnalytics();
  const { followUp, winLoss, sources } = analytics;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">{analytics.totalLeads} total leads</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Outreach logged" value={String(followUp.recorded)} />
            <Stat label="Replies" value={String(followUp.replied)} hint={`${pct(followUp.replyRate)} reply rate`} />
            <Stat label="Overdue follow-ups" value={String(followUp.overdue)} hint={`${followUp.dueToday} due today`} />
            <Stat
              label="In flight, no next step"
              value={String(followUp.inFlightWithoutFollowUp)}
              hint={`${followUp.scheduled} scheduled ahead`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By touch number</p>
              <ReplyTable rows={followUp.byTouch} firstColumn="Touch" />
              <p className="text-xs text-muted-foreground">
                Whether the second and third messages earn their time, or replies only ever come from the first.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By channel</p>
              <ReplyTable rows={followUp.byChannel} firstColumn="Channel" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Based only on outreach recorded in this app (drafts excluded) — it does not read any mailbox, so
            anything sent without logging it here is invisible to these numbers.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Win / loss analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Won" value={String(winLoss.won)} />
            <Stat label="Lost" value={String(winLoss.lost)} />
            <Stat
              label="Win rate"
              value={pct(winLoss.winRate)}
              hint={`of ${winLoss.decided} decided (${winLoss.open} still open)`}
            />
            <Stat
              label="Avg days to win"
              value={winLoss.avgDaysToWin === null ? "—" : String(winLoss.avgDaysToWin)}
              hint={
                winLoss.daysToWinSampleSize > 0
                  ? `from ${winLoss.daysToWinSampleSize} won lead(s)`
                  : "no status history yet"
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By tier</p>
              <SegmentTable rows={winLoss.byTier} firstColumn="Tier" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By vertical</p>
              <SegmentTable rows={winLoss.byVertical} firstColumn="Vertical" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why leads were lost</p>
            <BarList buckets={winLoss.lossReasons} total={winLoss.lost} />
            <p className="text-xs text-muted-foreground">
              Taken from the closing status, which is as specific as the schema records — there is no separate
              free-text loss reason.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Best sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads with evidence yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-1 pr-2">Source</th>
                    <th className="py-1 pr-2 text-right">Leads</th>
                    <th className="py-1 pr-2 text-right">Avg score</th>
                    <th className="py-1 pr-2 text-right">Contacted</th>
                    <th className="py-1 pr-2 text-right">Replied</th>
                    <th className="py-1 pr-2 text-right">Won</th>
                    <th className="py-1 text-right">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((row) => (
                    <tr key={row.label} className="border-b border-border/50 last:border-0">
                      <td className="py-1 pr-2">
                        <Badge variant="outline">{row.label}</Badge>
                      </td>
                      <td className="py-1 pr-2 text-right text-muted-foreground">{row.leads}</td>
                      <td className="py-1 pr-2 text-right text-muted-foreground">{row.avgScore}</td>
                      <td className="py-1 pr-2 text-right text-muted-foreground">{row.contacted}</td>
                      <td className="py-1 pr-2 text-right text-muted-foreground">{row.replied}</td>
                      <td className="py-1 pr-2 text-right text-success">{row.won}</td>
                      <td className="py-1 text-right font-medium">{pct(row.winRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A lead is attributed to the source of its earliest piece of evidence — the connector that surfaced it.
            Later evidence counts as enrichment, not discovery.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BarList buckets={analytics.byStatus} total={analytics.totalLeads} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By tier</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BarList buckets={analytics.byTier} total={analytics.totalLeads} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By vertical</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BarList buckets={analytics.byVertical} total={analytics.totalLeads} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By verification status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BarList buckets={analytics.byVerification} total={analytics.totalLeads} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top countries</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <BarList buckets={analytics.byCountry} total={analytics.totalLeads} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline snapshot</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="mb-2 text-xs text-muted-foreground">
              A snapshot of how many leads currently sit in each stage — not a cohort conversion funnel over time.
            </p>
            <BarList buckets={analytics.funnel} total={analytics.totalLeads} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
