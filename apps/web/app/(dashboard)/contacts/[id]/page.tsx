import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactDetail } from "../../../../lib/data/contacts";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { TierBadge, StatusBadge, Badge } from "../../../../components/ui/badge";
import { NoteForm } from "../../../../components/lead/note-form";
import { formatDateTime } from "../../../../lib/utils";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { contact, leads, outreach, notes, activities } = await getContactDetail(id);

  if (!contact) notFound();

  const company = (contact as any).company;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold">{contact.name ?? "Unnamed contact"}</h1>
              <p className="text-sm text-muted-foreground">
                {contact.job_title && <span>{contact.job_title}</span>}
                {company && (
                  <>
                    {contact.job_title && <span> · </span>}
                    <Link href={`/companies/${company.id}`} className="hover:text-primary">
                      {company.name}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <Badge variant="outline">{contact.verification_status.replace(/_/g, " ")}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-0 text-sm">
          <p>
            <span className="text-muted-foreground">Method: </span>
            {contact.contact_method ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Value: </span>
            {contact.contact_value ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {contact.email ?? "—"}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            {leads.length === 0 ? (
              <p className="text-muted-foreground">No opportunities linked.</p>
            ) : (
              leads.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between rounded-md border border-border p-2">
                  <div>
                    <Link href={`/leads/${l.id}`} className="font-medium hover:text-primary">
                      {l.title}
                    </Link>
                    {l.company && <p className="text-xs text-muted-foreground">{l.company.name}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <TierBadge tier={l.tier} />
                    <StatusBadge status={l.status} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outreach history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            {outreach.length === 0 ? (
              <p className="text-muted-foreground">No outreach recorded.</p>
            ) : (
              outreach.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-md border border-border p-2">
                  <div>
                    <span className="font-medium">{o.channel}</span>
                    {o.recipient && <span className="text-muted-foreground"> → {o.recipient}</span>}
                    {o.message && <p className="mt-1 text-muted-foreground">{o.message}</p>}
                  </div>
                  <Badge variant="outline">{o.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {activities.map((a) => (
                  <li key={a.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                    <p>{a.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(a.occurred_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <NoteForm contactId={contact.id} />
            {notes.map((n) => (
              <div key={n.id} className="rounded-md border border-border p-2 text-sm">
                <p>{n.body}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
