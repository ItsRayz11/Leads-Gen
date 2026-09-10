import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyDetail } from "../../../../lib/data/companies";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { TierBadge, StatusBadge, Badge } from "../../../../components/ui/badge";
import { NoteForm } from "../../../../components/lead/note-form";
import { TaskForm, TaskStatusToggle } from "../../../../components/lead/task-form";
import { formatDate, formatDateTime, timeAgo } from "../../../../lib/utils";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company, contacts, leads, activities, notes, tasks, sources } = await getCompanyDetail(id);

  if (!company) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold">{company.name}</h1>
              <p className="text-sm text-muted-foreground">
                {company.website && (
                  <a href={company.website} target="_blank" rel="noreferrer" className="hover:text-primary">
                    {company.website}
                  </a>
                )}
                {company.domain && <span> · {company.domain}</span>}
                {company.country && <span> · {company.country}</span>}
                {company.industry && <span> · {company.industry}</span>}
              </p>
            </div>
            {company.company_size && <Badge variant="outline">{company.company_size}</Badge>}
          </div>
          {company.description && <p className="border-t border-border pt-3 text-sm text-muted-foreground">{company.description}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            {contacts.length === 0 ? (
              <p className="text-muted-foreground">No contacts found yet.</p>
            ) : (
              contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div>
                    <Link href={`/contacts/${c.id}`} className="font-medium hover:text-primary">
                      {c.name ?? "Unnamed"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.job_title}</p>
                  </div>
                  <Badge variant="outline">{c.verification_status.replace(/_/g, " ")}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opportunities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            {leads.length === 0 ? (
              <p className="text-muted-foreground">No opportunities recorded.</p>
            ) : (
              leads.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between rounded-md border border-border p-2">
                  <div>
                    <Link href={`/leads/${l.id}`} className="font-medium hover:text-primary">
                      {l.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{l.vertical}</p>
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
            <CardTitle>Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            {sources.length === 0 ? (
              <p className="text-muted-foreground">No source history recorded.</p>
            ) : (
              sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-2">
                  <div>
                    <span className="font-medium">{s.source_name}</span>
                    {s.source_url && (
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-xs text-primary hover:underline"
                      >
                        {s.source_url}
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">first seen {timeAgo(s.first_seen_at)}</span>
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <TaskForm companyId={company.id} />
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <TaskStatusToggle id={t.id} status={t.status} />
                <span className={t.status === "completed" ? "text-muted-foreground line-through" : ""}>
                  {t.title}
                </span>
                {t.due_date && <span className="ml-auto text-xs text-muted-foreground">{formatDate(t.due_date)}</span>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <NoteForm companyId={company.id} />
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
