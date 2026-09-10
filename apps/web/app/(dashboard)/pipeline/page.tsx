import Link from "next/link";
import { getPipelineBoard } from "../../../lib/data/pipeline";
import { TierBadge } from "../../../components/ui/badge";
import { StatusSelect } from "../../../components/lead/status-select";
import { formatDate } from "../../../lib/utils";

const COLUMN_TITLES: Record<string, string> = {
  new: "New",
  researching: "Researching",
  qualified: "Qualified",
  contacted: "Contacted",
  follow_up: "Follow Up",
  replied: "Replied",
  meeting: "Meeting",
  negotiation: "Negotiation",
  won: "Won",
};

export default async function PipelinePage() {
  const columns = await getPipelineBoard();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Active leads across the working pipeline</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
          <div key={column.status} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-medium">{COLUMN_TITLES[column.status] ?? column.status}</h2>
              <span className="text-xs text-muted-foreground">{column.leads.length}</span>
            </div>
            <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
              {column.leads.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">No leads</p>
              ) : (
                column.leads.map((lead) => (
                  <div key={lead.id} className="rounded-md border border-border bg-card p-2 text-sm">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary">
                      {lead.company?.name ?? "Unknown"}
                    </Link>
                    <div className="mt-1 flex items-center justify-between">
                      <TierBadge tier={lead.tier} />
                      <span className="text-xs text-muted-foreground">{lead.score}</span>
                    </div>
                    {lead.next_follow_up_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Follow up {formatDate(lead.next_follow_up_at)}
                      </p>
                    )}
                    <div className="mt-2">
                      <StatusSelect leadId={lead.id} status={lead.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
