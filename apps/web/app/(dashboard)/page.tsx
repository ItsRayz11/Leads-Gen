import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { getDashboardMetrics, getTodaysWork } from "../../lib/data/dashboard";
import { formatDate } from "../../lib/utils";

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <Card className="transition-colors hover:border-primary/40">
      <CardHeader className="pb-1">
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function WorkSection({
  title,
  items,
}: {
  title: string;
  items: { id: string; title: string; companyName: string | null; dueDate: string | null }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/leads/${item.id}`} className="flex items-center justify-between text-sm hover:text-primary">
                  <span>
                    <span className="font-medium">{item.companyName ?? "Unknown"}</span>
                    <span className="text-muted-foreground"> — {item.title}</span>
                  </span>
                  {item.dueDate && <span className="text-xs text-muted-foreground">{formatDate(item.dueDate)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const [metrics, work] = await Promise.all([getDashboardMetrics(), getTodaysWork()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your command center — who to contact, and why.</p>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lead metrics</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Stat label="Total Leads" value={metrics.totalLeads} href="/leads" />
          <Stat label="New" value={metrics.newLeads} href="/leads?status=new" />
          <Stat label="Qualified" value={metrics.qualifiedLeads} href="/leads?status=qualified" />
          <Stat label="A+" value={metrics.tierCounts["A+"] ?? 0} href="/leads?tier=A%2B" />
          <Stat label="A" value={metrics.tierCounts["A"] ?? 0} href="/leads?tier=A" />
          <Stat label="High Intent" value={metrics.highIntent} />
          <Stat label="B" value={metrics.tierCounts["B"] ?? 0} href="/leads?tier=B" />
          <Stat label="C" value={metrics.tierCounts["C"] ?? 0} href="/leads?tier=C" />
          <Stat label="Needs Verification" value={metrics.needsVerification} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">CRM metrics</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Stat label="Contacted" value={metrics.contacted} />
          <Stat label="Awaiting Reply" value={metrics.awaitingReply} />
          <Stat label="Follow-ups Due" value={metrics.followUpsDueToday} href="/follow-ups" />
          <Stat label="Overdue" value={metrics.overdueFollowUps} href="/follow-ups" />
          <Stat label="Meetings" value={metrics.meetings} href="/pipeline" />
          <Stat label="Won" value={metrics.won} href="/pipeline" />
          <Stat label="Lost" value={metrics.lost} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Today's work</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <WorkSection title="Overdue Follow-ups" items={work.overdueFollowUps} />
          <WorkSection title="Today's Follow-ups" items={work.todayFollowUps} />
          <WorkSection title="New High-Intent Leads" items={work.highIntentNew} />
          <WorkSection title="Overdue Tasks" items={work.overdueTasks} />
        </div>
      </section>
    </div>
  );
}
