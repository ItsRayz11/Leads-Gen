import Link from "next/link";
import { getFollowUps, type FollowUpRow } from "../../../lib/data/follow-ups";
import { TierBadge } from "../../../components/ui/badge";
import { formatDate } from "../../../lib/utils";

function FollowUpSection({ title, leads }: { title: string; leads: FollowUpRow[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} ({leads.length})
      </h2>
      <div className="rounded-lg border border-border">
        {leads.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          leads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-0"
            >
              <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary">
                {lead.company?.name ?? "Unknown"}
              </Link>
              <span className="text-muted-foreground">{lead.title}</span>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatDate(lead.next_follow_up_at)}</span>
                <TierBadge tier={lead.tier} />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default async function FollowUpsPage() {
  const buckets = await getFollowUps();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">Leads with a scheduled next follow-up</p>
      </div>

      <FollowUpSection title="Overdue" leads={buckets.overdue} />
      <FollowUpSection title="Today" leads={buckets.today} />
      <FollowUpSection title="Tomorrow" leads={buckets.tomorrow} />
      <FollowUpSection title="This Week" leads={buckets.thisWeek} />
      <FollowUpSection title="Upcoming" leads={buckets.upcoming} />
    </div>
  );
}
