"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SCORE_DIMENSIONS, DIMENSION_LABELS, type ScoreDimension } from "@leads/core";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { LEAD_TIERS } from "../lib/lead-options";

interface TierThreshold {
  tier: string;
  min: number;
}

export function ScoringConfigForm({
  vertical,
  dimensionWeights,
  tierThresholds,
}: {
  vertical: string;
  dimensionWeights: Partial<Record<ScoreDimension, number>>;
  tierThresholds: TierThreshold[];
}) {
  const [weights, setWeights] = useState<Partial<Record<ScoreDimension, number>>>(dimensionWeights);
  const [thresholds, setThresholds] = useState<TierThreshold[]>(
    LEAD_TIERS.map((tier) => ({ tier, min: tierThresholds.find((t) => t.tier === tier)?.min ?? 0 }))
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function onSave() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/scoring-config/${vertical}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimension_weights: weights, tier_thresholds: thresholds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save scoring config.");
        return;
      }
      setMessage("Saved. New leads and re-scores in this vertical will use these values.");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dimension weights
        </p>
        <div className="space-y-2">
          {SCORE_DIMENSIONS.map((dimension) => (
            <label key={dimension} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{DIMENSION_LABELS[dimension]}</span>
              <Input
                type="number"
                min={0}
                className="w-20"
                value={weights[dimension] ?? 0}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, [dimension]: Math.max(0, Number(e.target.value) || 0) }))
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tier cutoffs (min score, 0-100)
        </p>
        <div className="space-y-2">
          {thresholds.map((t, i) => (
            <label key={t.tier} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{t.tier}</span>
              <Input
                type="number"
                min={0}
                max={100}
                className="w-20"
                value={t.min}
                onChange={(e) => {
                  const min = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  setThresholds((prev) => prev.map((row, idx) => (idx === i ? { ...row, min } : row)));
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 flex items-center gap-3">
        <Button type="button" size="sm" disabled={busy} onClick={onSave}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {message && <p className="text-xs text-success">{message}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
