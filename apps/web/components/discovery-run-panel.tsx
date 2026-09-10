"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "./ui/button";

type Vertical = "vertical1" | "vertical2" | "vertical3";

const VERTICALS: { id: Vertical; label: string }[] = [
  { id: "vertical1", label: "Hiring signals" },
  { id: "vertical2", label: "General (HN)" },
  { id: "vertical3", label: "Card affiliate" },
];

type RunResult = {
  signalsFound: number;
  connectorCounts: { connector: string; signalsFound: number }[];
  leadsUpserted: { companyName: string; score: number }[];
};

export function DiscoveryRunPanel() {
  const [busy, setBusy] = useState<Vertical | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [ranVertical, setRanVertical] = useState<Vertical | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function onRun(vertical: Vertical) {
    setBusy(vertical);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Discovery run failed.");
        return;
      }
      setResult(data);
      setRanVertical(vertical);
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {VERTICALS.map((v) => (
          <Button key={v.id} type="button" size="sm" disabled={busy !== null} onClick={() => onRun(v.id)}>
            {busy === v.id ? "Running…" : `Run ${v.label}`}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Runs the connectors for that vertical right now and writes matches directly into this database, same as{" "}
        <code className="text-foreground">npm run run:{ranVertical ?? "vertical1"}</code> or the scheduled GitHub
        Action. This can take up to a few minutes depending on how many connectors are enabled.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {result && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
          <p className="font-medium text-foreground">
            {result.signalsFound} signal(s) found, {result.leadsUpserted.length} lead(s) upserted.
          </p>
          {result.connectorCounts.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {result.connectorCounts.map((c) => (
                <li key={c.connector}>
                  {c.connector}: {c.signalsFound}
                </li>
              ))}
            </ul>
          )}
          {result.leadsUpserted.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {result.leadsUpserted.slice(0, 10).map((l) => (
                <li key={l.companyName}>
                  [{l.score}] {l.companyName}
                </li>
              ))}
              {result.leadsUpserted.length > 10 && <li>…and {result.leadsUpserted.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
