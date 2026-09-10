"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../ui/button";
import { Input, Select, Textarea } from "../ui/input";
import {
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  LEAD_TIERS,
  LEAD_VERTICALS,
  SIGNAL_STRENGTH_OPTIONS,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
  VERTICAL_LABELS,
  humanize,
} from "../../lib/lead-options";
import type { CompanyOption } from "../../lib/data/companies";

export interface LeadFormValues {
  companyId: string;
  title: string;
  vertical: string;
  opportunity_type: string;
  service_type: string;
  score: string;
  tier: string;
  status: string;
  priority: string;
  buying_signal_summary: string;
  signal_strength: string;
  signal_date: string;
  verification_status: string;
  source_type: string;
  owner: string;
  next_follow_up_at: string;
  recommended_offer: string;
  qualification_summary: string;
  primary_contact_id: string;
}

export interface ContactOption {
  id: string;
  name: string | null;
  job_title: string | null;
}

const EMPTY: LeadFormValues = {
  companyId: "",
  title: "",
  vertical: "general",
  opportunity_type: "",
  service_type: "",
  score: "0",
  tier: "",
  status: "new",
  priority: "normal",
  buying_signal_summary: "",
  signal_strength: "",
  signal_date: "",
  verification_status: "unverified",
  source_type: "",
  owner: "",
  next_follow_up_at: "",
  recommended_offer: "",
  qualification_summary: "",
  primary_contact_id: "",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

/**
 * One form for both creating and editing a lead. Create can also make the
 * company, first contact and a piece of evidence in the same submit, since a
 * lead typed in by hand usually arrives with all three at once. Edit leaves
 * the company alone — moving an opportunity to another company is a different
 * operation, and the (company_id, title) unique index makes it a rename too.
 */
export function LeadForm({
  mode,
  companies,
  leadId,
  initial,
  contacts = [],
  companyName,
}: {
  mode: "create" | "edit";
  companies: CompanyOption[];
  leadId?: string;
  initial?: Partial<LeadFormValues>;
  contacts?: ContactOption[];
  companyName?: string;
}) {
  const [values, setValues] = useState<LeadFormValues>({ ...EMPTY, ...initial });
  const [newCompany, setNewCompany] = useState(mode === "create" && companies.length === 0);
  const [company, setCompany] = useState({
    name: "",
    website: "",
    country: "",
    industry: "",
    companySize: "",
  });
  const [contact, setContact] = useState({ name: "", jobTitle: "", email: "", profileUrl: "" });
  const [evidence, setEvidence] = useState({ url: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof LeadFormValues>(key: K, value: LeadFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (mode === "create") {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: newCompany ? undefined : values.companyId || undefined,
            company: newCompany ? company : undefined,
            title: values.title,
            vertical: values.vertical,
            opportunityType: values.opportunity_type,
            serviceType: values.service_type,
            score: values.score,
            tier: values.tier,
            status: values.status,
            priority: values.priority,
            buyingSignalSummary: values.buying_signal_summary,
            signalStrength: values.signal_strength,
            signalDate: values.signal_date,
            verificationStatus: values.verification_status,
            sourceType: values.source_type,
            owner: values.owner,
            nextFollowUpAt: values.next_follow_up_at,
            recommendedOffer: values.recommended_offer,
            qualificationSummary: values.qualification_summary,
            contact,
            evidence,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not create the lead.");
          return;
        }
        startTransition(() => router.push(`/leads/${data.id}`));
        return;
      }

      const { companyId: _companyId, ...patch } = values;
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save the lead.");
        return;
      }
      startTransition(() => {
        router.push(`/leads/${leadId}`);
        router.refresh();
      });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Section title="Company">
        {mode === "edit" ? (
          <p className="text-sm text-muted-foreground">
            {companyName ?? "Unknown company"} — a lead stays with the company it was created under.
          </p>
        ) : newCompany ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Company name *">
                <Input
                  required
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                />
              </Field>
              <Field label="Website" hint="Matched by domain against companies already on file.">
                <Input
                  placeholder="https://example.com"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                />
              </Field>
              <Field label="Country">
                <Input value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value })} />
              </Field>
              <Field label="Industry">
                <Input
                  value={company.industry}
                  onChange={(e) => setCompany({ ...company, industry: e.target.value })}
                />
              </Field>
              <Field label="Company size">
                <Input
                  placeholder="1-10, 11-50, ..."
                  value={company.companySize}
                  onChange={(e) => setCompany({ ...company, companySize: e.target.value })}
                />
              </Field>
            </div>
            {companies.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewCompany(false)}>
                Pick an existing company instead
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Field label="Company *">
              <Select
                required
                className="w-full"
                value={values.companyId}
                onChange={(e) => set("companyId", e.target.value)}
              >
                <option value="">Select a company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.domain ? ` (${c.domain})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="button" variant="ghost" size="sm" onClick={() => setNewCompany(true)}>
              + New company
            </Button>
          </div>
        )}
      </Section>

      <Section title="Opportunity">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Lead title"
            hint={mode === "create" ? "Left blank, the company name is used." : undefined}
          >
            <Input
              value={values.title}
              placeholder="Community Manager hiring signal"
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          <Field label="Vertical">
            <Select className="w-full" value={values.vertical} onChange={(e) => set("vertical", e.target.value)}>
              {LEAD_VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {VERTICAL_LABELS[v]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Opportunity type">
            <Input
              placeholder="kol_marketing, affiliate, community_mgmt..."
              value={values.opportunity_type}
              onChange={(e) => set("opportunity_type", e.target.value)}
            />
          </Field>
          <Field label="Service type">
            <Input
              placeholder="Community management, X growth..."
              value={values.service_type}
              onChange={(e) => set("service_type", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Scoring and pipeline">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Score (0-100)">
            <Input
              type="number"
              min={0}
              max={100}
              value={values.score}
              onChange={(e) => set("score", e.target.value)}
            />
          </Field>
          <Field label="Tier">
            <Select className="w-full" value={values.tier} onChange={(e) => set("tier", e.target.value)}>
              <option value="">No tier</option>
              {LEAD_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select className="w-full" value={values.status} onChange={(e) => set("status", e.target.value)}>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select className="w-full" value={values.priority} onChange={(e) => set("priority", e.target.value)}>
              {LEAD_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Verification">
            <Select
              className="w-full"
              value={values.verification_status}
              onChange={(e) => set("verification_status", e.target.value)}
            >
              {VERIFICATION_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {humanize(v)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source">
            <Select className="w-full" value={values.source_type} onChange={(e) => set("source_type", e.target.value)}>
              <option value="">Unknown</option>
              {SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner">
            <Input value={values.owner} onChange={(e) => set("owner", e.target.value)} />
          </Field>
          <Field label="Next follow-up">
            <Input
              type="date"
              value={values.next_follow_up_at}
              onChange={(e) => set("next_follow_up_at", e.target.value)}
            />
          </Field>
          {mode === "edit" && (
            <Field label="Primary contact">
              <Select
                className="w-full"
                value={values.primary_contact_id}
                onChange={(e) => set("primary_contact_id", e.target.value)}
              >
                <option value="">None</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? "Unnamed"}
                    {c.job_title ? ` - ${c.job_title}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Section>

      <Section title="Buying signal">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Signal strength">
            <Select
              className="w-full"
              value={values.signal_strength}
              onChange={(e) => set("signal_strength", e.target.value)}
            >
              <option value="">Not set</option>
              {SIGNAL_STRENGTH_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Signal date">
            <Input type="date" value={values.signal_date} onChange={(e) => set("signal_date", e.target.value)} />
          </Field>
        </div>
        <Field label="Signal summary">
          <Textarea
            rows={2}
            placeholder="What tells you they need this now?"
            value={values.buying_signal_summary}
            onChange={(e) => set("buying_signal_summary", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Qualification">
        <Field label="Qualification summary">
          <Textarea
            rows={3}
            value={values.qualification_summary}
            onChange={(e) => set("qualification_summary", e.target.value)}
          />
        </Field>
        <Field label="Recommended offer">
          <Textarea
            rows={2}
            value={values.recommended_offer}
            onChange={(e) => set("recommended_offer", e.target.value)}
          />
        </Field>
      </Section>

      {mode === "create" && (
        <>
          <Section title="First contact (optional)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
              </Field>
              <Field label="Job title">
                <Input
                  value={contact.jobTitle}
                  onChange={(e) => setContact({ ...contact, jobTitle: e.target.value })}
                />
              </Field>
              <Field label="Email" hint="Only if it is publicly listed - never a guessed pattern.">
                <Input
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                />
              </Field>
              <Field label="Profile URL">
                <Input
                  placeholder="https://x.com/..."
                  value={contact.profileUrl}
                  onChange={(e) => setContact({ ...contact, profileUrl: e.target.value })}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Filled in, this contact becomes the lead&apos;s primary contact.
            </p>
          </Section>

          <Section title="Evidence (optional)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Source URL">
                <Input
                  placeholder="https://..."
                  value={evidence.url}
                  onChange={(e) => setEvidence({ ...evidence, url: e.target.value })}
                />
              </Field>
              <Field label="What it shows">
                <Input
                  value={evidence.description}
                  onChange={(e) => setEvidence({ ...evidence, description: e.target.value })}
                />
              </Field>
            </div>
          </Section>
        </>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : mode === "create" ? "Create lead" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" disabled={saving} onClick={() => router.back()}>
          Cancel
        </Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
