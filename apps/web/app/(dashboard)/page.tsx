import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  Sparkles,
  CheckCircle2,
  Trophy,
  Star,
  Flame,
  ShieldAlert,
  Mail,
  Clock,
  CalendarClock,
  AlertTriangle,
  CalendarCheck,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { getDashboardMetrics, getTodaysWork } from "../../lib/data/dashboard";
import { cn, formatDate } from "../../lib/utils";

const TONE_CLASSES = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
} as const;

function Stat({
  label,
  value,
  href,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: number;
  href?: string;
  icon?: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
}) {
  const inner = (
    <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-snug text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        {Icon && (
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", TONE_CLASSES[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
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
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your command center — who to contact, and why.</p>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead metrics</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Stat label="Total Leads" value={metrics.totalLeads} href="/leads" icon={Users} tone="muted" />
          <Stat label="New" value={metrics.newLeads} href="/leads?status=new" icon={Sparkles} tone="primary" />
          <Stat
            label="Qualified"
            value={metrics.qualifiedLeads}
            href="/leads?status=qualified"
            icon={CheckCircle2}
            tone="success"
          />
          <Stat
            label="A+"
            value={metrics.tierCounts["A+"] ?? 0}
            href="/leads?tier=A%2B"
            icon={Trophy}
            tone="success"
          />
          <Stat label="A" value={metrics.tierCounts["A"] ?? 0} href="/leads?tier=A" icon={Star} tone="success" />
          <Stat label="High Intent" value={metrics.highIntent} icon={Flame} tone="warning" />
          <Stat label="B" value={metrics.tierCounts["B"] ?? 0} href="/leads?tier=B" icon={Star} tone="primary" />
          <Stat label="C" value={metrics.tierCounts["C"] ?? 0} href="/leads?tier=C" icon={Star} tone="muted" />
          <Stat label="Needs Verification" value={metrics.needsVerification} icon={ShieldAlert} tone="warning" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">CRM metrics</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Stat label="Contacted" value={metrics.contacted} icon={Mail} tone="primary" />
          <Stat label="Awaiting Reply" value={metrics.awaitingReply} icon={Clock} tone="warning" />
          <Stat
            label="Follow-ups Due"
            value={metrics.followUpsDueToday}
            href="/follow-ups"
            icon={CalendarClock}
            tone="warning"
          />
          <Stat
            label="Overdue"
            value={metrics.overdueFollowUps}
            href="/follow-ups"
            icon={AlertTriangle}
            tone="destructive"
          />
          <Stat label="Meetings" value={metrics.meetings} href="/pipeline" icon={CalendarCheck} tone="primary" />
          <Stat label="Won" value={metrics.won} href="/pipeline" icon={Trophy} tone="success" />
          <Stat label="Lost" value={metrics.lost} icon={XCircle} tone="destructive" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's work</h2>
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
