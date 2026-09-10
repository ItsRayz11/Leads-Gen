import Link from "next/link";
import { listOutreach } from "../../../lib/data/outreach";
import { formatDate, formatDateTime } from "../../../lib/utils";
import { OutreachResultControl } from "../../../components/lead/outreach-result";

function truncate(text: string | null, length: number): string {
  if (!text) return "—";
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export default async function OutreachPage() {
  const outreach = await listOutreach();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Outreach</h1>
        <p className="text-sm text-muted-foreground">{outreach.length} outreach records across all leads</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Company / Lead</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Recipient</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2">Follow-up</th>
              <th className="px-3 py-2">Message</th>
            </tr>
          </thead>
          <tbody>
            {outreach.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No outreach recorded yet.
                </td>
              </tr>
            ) : (
              outreach.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/leads/${o.lead_id}`} className="font-medium hover:text-primary">
                      {o.lead?.company?.name ?? "Unknown"}
                    </Link>
                    {o.lead?.title && <div className="text-xs text-muted-foreground">{o.lead.title}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{o.contact?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.channel}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.recipient ?? "—"}</td>
                  <td className="px-3 py-2">
                    <OutreachResultControl outreachId={o.id} status={o.status} result={o.result} compact />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDateTime(o.sent_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(o.follow_up_date)}</td>
                  <td className="max-w-xs px-3 py-2 text-muted-foreground">{truncate(o.message, 80)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
