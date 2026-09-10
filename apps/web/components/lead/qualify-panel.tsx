"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select, Textarea } from "../ui/input";
import { SIGNAL_STRENGTHS, type QualificationDraft } from "../../lib/ai/qualification-prompt";

function ReasonList({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" | "muted" }) {
  if (items.length === 0) return null;
  const toneClass =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-muted-foreground";
  return (
    <div className="space-y-1">
      <p className={`text-xs font-medium uppercase tracking-wide ${toneClass}`}>{title}</p>
      <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Generate → review → save. The draft is editable and nothing touches the
 * lead until "Save to lead" is pressed, so a wrong AI judgement is a
 * discarded suggestion rather than a corrupted record.
 */
export function QualifyPanel({
  leadId,
  currentSummary,
  currentOffer,
}: {
  leadId: string;
  currentSummary: string | null;
  currentOffer: string | null;
}) {
  const [draft, setDraft] = useState<QualificationDraft | null>(null);
  const [origin, setOrigin] = useState<{ provider: string; model: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/leads/${leadId}/qualify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not generate a qualification.");
        return;
      }
      setDraft(data.draft as QualificationDraft);
      setOrigin({ provider: data.provider, model: data.model });
    } catch {
      setError("Could not reach the qualification endpoint.");
    } finally {
      setGenerating(false);
    }
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/qualify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, provider: origin?.provider, model: origin?.model }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Could not save the qualification.");
        return;
      }
      setSaved(true);
      setDraft(null);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {currentSummary ? (
        <p className="text-sm">{currentSummary}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No qualification summary on file yet.</p>
      )}
      {currentOffer && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Recommended offer on file:</span> {currentOffer}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={generating} onClick={onGenerate}>
          {generating ? "Assessing…" : currentSummary ? "Re-assess with AI" : "Assess with AI"}
        </Button>
        {origin && draft && (
          <Badge variant="primary">
            Drafted by {origin.provider} ({origin.model})
          </Badge>
        )}
        {saved && <span className="text-xs text-success">Saved to lead.</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {draft && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Qualification summary</label>
            <Textarea
              rows={4}
              value={draft.qualificationSummary}
              onChange={(e) => setDraft({ ...draft, qualificationSummary: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Recommended offer</label>
            <Textarea
              rows={2}
              value={draft.recommendedOffer ?? ""}
              onChange={(e) => setDraft({ ...draft, recommendedOffer: e.target.value || null })}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Signal strength</label>
            <Select
              value={draft.signalStrength ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  signalStrength: (e.target.value || null) as QualificationDraft["signalStrength"],
                })
              }
            >
              <option value="">Leave unchanged</option>
              {SIGNAL_STRENGTHS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <ReasonList title="Why it fits" items={draft.fitReasons} tone="success" />
          <ReasonList title="Risks" items={draft.risks} tone="warning" />
          <ReasonList title="Still needs checking" items={draft.missingInformation} tone="muted" />

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={onSave}>
              {saving ? "Saving…" : "Save to lead"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setDraft(null)}>
              Discard
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fit, risks and open questions are stored on the activity timeline when you save — the lead itself only
            keeps the summary, offer and signal strength.
          </p>
        </div>
      )}
    </div>
  );
}
