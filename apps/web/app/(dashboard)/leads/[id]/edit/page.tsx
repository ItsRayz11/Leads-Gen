import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadDetail } from "../../../../../lib/data/leads";
import { listCompanyOptions } from "../../../../../lib/data/companies";
import { LeadForm } from "../../../../../components/lead/lead-form";

/** `date`/`timestamptz` columns come back ISO — the date inputs want YYYY-MM-DD. */
function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead, companyContacts }, companies] = await Promise.all([
    getLeadDetail(id),
    listCompanyOptions(),
  ]);

  if (!lead) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Edit lead</h1>
          <p className="text-sm text-muted-foreground">{lead.title}</p>
        </div>
        <Link href={`/leads/${id}`} className="text-sm text-primary hover:underline">
          Back to lead
        </Link>
      </div>

      <LeadForm
        mode="edit"
        leadId={id}
        companies={companies}
        companyName={lead.company?.name}
        contacts={companyContacts.map((c: { id: string; name: string | null; job_title: string | null }) => ({
          id: c.id,
          name: c.name,
          job_title: c.job_title,
        }))}
        initial={{
          companyId: lead.company_id,
          title: lead.title ?? "",
          vertical: lead.vertical ?? "general",
          opportunity_type: lead.opportunity_type ?? "",
          service_type: lead.service_type ?? "",
          score: String(lead.score ?? 0),
          tier: lead.tier ?? "",
          status: lead.status ?? "new",
          priority: lead.priority ?? "normal",
          buying_signal_summary: lead.buying_signal_summary ?? "",
          signal_strength: lead.signal_strength ?? "",
          signal_date: dateInputValue(lead.signal_date),
          verification_status: lead.verification_status ?? "unverified",
          source_type: lead.source_type ?? "",
          owner: lead.owner ?? "",
          next_follow_up_at: dateInputValue(lead.next_follow_up_at),
          recommended_offer: lead.recommended_offer ?? "",
          qualification_summary: lead.qualification_summary ?? "",
          primary_contact_id: lead.primary_contact_id ?? "",
        }}
      />
    </div>
  );
}
