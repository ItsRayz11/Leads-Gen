"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input, Select, Textarea } from "../ui/input";
import { Button } from "../ui/button";
import { DRAFT_TYPES, type DraftType } from "../../lib/ai/outreach-prompt";
import { OUTREACH_STATUSES } from "./outreach-result";

const CHANNELS = ["email", "x", "telegram", "linkedin", "whatsapp", "other"];

export function OutreachForm({ leadId }: { leadId: string }) {
  const [channel, setChannel] = useState("email");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [status, setStatus] = useState("sent");
  const [result, setResult] = useState("");
  const [draftType, setDraftType] = useState<DraftType>("initial");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, channel, recipient, message, followUpDate, status, result }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSubmitError(data?.error ?? `Could not record this outreach (${res.status}). Nothing was saved.`);
        return;
      }
      setMessage("");
      setRecipient("");
      setFollowUpDate("");
      setResult("");
      setStatus("sent");
      startTransition(() => router.refresh());
    } catch {
      setSubmitError("Could not reach the server. Nothing was saved.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onGenerateDraft() {
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/draft-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDraftError(data.error ?? "Could not generate a draft.");
        return;
      }
      setMessage(data.draft);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap gap-2">
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-36">
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input placeholder="Recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="flex-1" />
        <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-40" title="Set next follow-up" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32" title="Result">
          {OUTREACH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Result note (what came back, if anything)"
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="flex-1"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={draftType} onChange={(e) => setDraftType(e.target.value as DraftType)} className="w-48">
          {DRAFT_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" size="sm" disabled={drafting} onClick={onGenerateDraft}>
          {drafting ? "Generating…" : "Generate with AI"}
        </Button>
        {draftError && <span className="text-xs text-destructive">{draftError}</span>}
      </div>

      <Textarea
        rows={4}
        placeholder="Message sent (paste what you sent, for your own record) — or generate a draft above and edit it before sending."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={pending || submitting}>
        {submitting ? "Recording…" : "Record outreach"}
      </Button>
      {submitError && <p className="text-xs text-destructive">{submitError}</p>}
    </form>
  );
}
