"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../ui/button";
import { Input, Select, Textarea } from "../ui/input";
import { LEAD_TIERS } from "../../lib/lead-options";

/**
 * Overrides the computed score and tier by hand. Collapsed by default — the
 * scorer's number is the one that should normally stand, and an override
 * needs a reason before it will save.
 */
export function ScoreOverride({
  leadId,
  score,
  tier,
}: {
  leadId: string;
  score: number;
  tier: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [nextScore, setNextScore] = useState(String(score));
  const [nextTier, setNextTier] = useState(tier ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/score-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: nextScore, tier: nextTier, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save the override.");
        return;
      }
      setReason("");
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Override score
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Score</label>
          <Input
            type="number"
            min={0}
            max={100}
            className="w-24"
            value={nextScore}
            onChange={(e) => setNextScore(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tier</label>
          <Select value={nextTier} onChange={(e) => setNextTier(e.target.value)}>
            <option value="">No tier</option>
            {LEAD_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Textarea
        rows={2}
        placeholder="Why does your judgement beat the scorer here? (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={saving || !reason.trim()} onClick={onSave}>
          {saving ? "Saving..." : "Save override"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => {
            setOpen(false);
            setNextScore(String(score));
            setNextTier(tier ?? "");
            setReason("");
          }}
        >
          Cancel
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Saved as a new score record flagged as a human override — the computed score stays on file.
      </p>
    </div>
  );
}
