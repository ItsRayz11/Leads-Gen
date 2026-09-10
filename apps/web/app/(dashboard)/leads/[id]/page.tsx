import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadDetail } from "../../../../lib/data/leads";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { TierBadge, Badge, FreshnessBadge } from "../../../../components/ui/badge";
import { StatusSelect } from "../../../../components/lead/status-select";
import { FollowUpInput } from "../../../../components/lead/follow-up-input";
import { NoteForm } from "../../../../components/lead/note-form";
import { TaskForm, TaskStatusToggle } from "../../../../components/lead/task-form";
import { OutreachForm } from "../../../../components/lead/outreach-form";
import { OutreachResultControl } from "../../../../components/lead/outreach-result";
import { QualifyPanel } from "../../../../components/lead/qualify-panel";
import { VerificationControl } from "../../../../components/lead/verification-control";
import { ScoreOverride } from "../../../../components/lead/score-override";
import { ScoreDimensions } from "../../../../components/lead/score-dimensions";
import { Button } from "../../../../components/ui/button";
import { formatDate, formatDateTime, timeAgo } from "../../../../lib/utils";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lead, signals, evidence, latestScore, activities, outreach, tasks, notes, companyContacts, tags } =
    await getLeadDetail(id);

  if (!lead) notFound();

  const company = lead.company;
  const primaryContact = lead.primary_contact;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold">{company?.name ?? "Unknown company"}</h1>
              <p className="text-sm text-muted-foreground">
                {company?.website && (
                  <a href={company.website} target="_blank" rel="noreferrer" className="hover:text-primary">
                    {company.website}
                  </a>
                )}
                {company?.country && <span> · {company.country}</span>}
                {company?.industry && <span> · {company.industry}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TierBadge tier={lead.tier} />
              {lead.signal_strength === "strong" && <Badge variant="primary">High intent</Badge>}
              <Link href={`/leads/${lead.id}/edit`}>
                <Button variant="secondary" size="sm">
                  Edit lead
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm">
            <div>
              <span className="text-muted-foreground">Score </span>
              <span className="font-semibold">{lead.score}/100</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status</span>
              <StatusSelect leadId={lead.id} status={lead.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Next follow-up</span>
              <FollowUpInput leadId={lead.id} value={lead.next_follow_up_at} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Verification</span>
              <VerificationControl leadId={lead.id} status={lead.verification_status} />
            </div>
            {tags.length > 0 && (
              <div className="flex gap-1">
                {tags.map((t: any) => (
                  <Badge key={t.id}>{t.name}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why this lead?</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <QualifyPanel
            leadId={lead.id}
            currentSummary={lead.qualification_summary}
            currentOffer={lead.recommended_offer}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Score breakdown
            {latestScore?.is_human_override && <Badge variant="warning">Human override</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-sm">
          {latestScore ? (
            <>
              <ScoreDimensions score={latestScore} tierLimitedBy={latestScore.tier_limited_by} />
              <ul className="space-y-1">
                {Array.isArray(latestScore.breakdown) &&
                  (latestScore.breakdown as any[]).map((b, i) => (
                    <li key={i} className="flex justify-between border-b border-border/50 py-1 last:border-0">
                      <span className="text-muted-foreground">{b.label}</span>
                      <span className={b.points >= 0 ? "text-success" : "text-destructive"}>
                        {b.points >= 0 ? "+" : ""}
                        {b.points}
                      </span>
                    </li>
                  ))}
              </ul>
              {latestScore.override_reason && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Override reason:</span> {latestScore.override_reason}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              No scoring record on file — this lead&apos;s score of {lead.score} was set directly.
            </p>
          )}
          <ScoreOverride leadId={lead.id} score={lead.score} tier={lead.tier} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buying signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {signals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No signals recorded.</p>
            ) : (
              signals.map((s) => (
                <div key={s.id} className="rounded-md border border-border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.signal_type}</span>
                    <FreshnessBadge freshness={s.freshness} />
                  </div>
                  <p className="text-muted-foreground">{s.signal_description}</p>
                  {s.signal_date && <p className="text-xs text-muted-foreground">{formatDate(s.signal_date)}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No evidence recorded.</p>
            ) : (
              evidence.map((e) => (
                <div key={e.id} className="rounded-md border border-border p-2 text-sm">
                  <p>{e.description}</p>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      {e.source_title ?? e.url}
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {e.source} · discovered {timeAgo(e.discovered_at)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0 text-sm">
            {company ? (
              <>
                <Link href={`/companies/${company.id}`} className="text-primary hover:underline">
                  View company profile
                </Link>
                {company.description && <p className="text-muted-foreground">{company.description}</p>}
              </>
            ) : (
              <p className="text-muted-foreground">No company linked.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            {companyContacts.length === 0 ? (
              <p className="text-muted-foreground">No contacts found yet.</p>
            ) : (
              companyContacts.map((c: any) => (
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
            <CardTitle>Opportunity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0 text-sm">
            <p>
              <span className="text-muted-foreground">Type: </span>
              {lead.opportunity_type ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Service: </span>
              {lead.service_type ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Vertical: </span>
              {lead.vertical}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended offer</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            {lead.recommended_offer ?? "Not generated yet."}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outreach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <OutreachForm leadId={lead.id} />
          <div className="space-y-2">
            {outreach.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outreach recorded yet.</p>
            ) : (
              outreach.map((o) => (
                <div key={o.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{o.channel}</span>
                    {o.recipient && <span className="text-muted-foreground"> → {o.recipient}</span>}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {o.sent_at ? formatDateTime(o.sent_at) : "not sent"}
                    </span>
                    {o.message && <p className="mt-1 text-muted-foreground">{o.message}</p>}
                  </div>
                  <OutreachResultControl outreachId={o.id} status={o.status} result={o.result} />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <TaskForm leadId={lead.id} />
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
              <NoteForm leadId={lead.id} />
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
    </div>
  );
}
