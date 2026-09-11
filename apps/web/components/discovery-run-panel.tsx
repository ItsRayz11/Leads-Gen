"use client";

import { Button } from "./ui/button";
import { DiscoveryRunProgress } from "./discovery-run-progress";
import { useDiscoveryRun, type Vertical } from "../lib/hooks/use-discovery-run";

const VERTICALS: { id: Vertical; label: string; hint: string }[] = [
  {
    id: "vertical1",
    label: "Hiring signals",
    hint: "Greenhouse, Lever, Ashby, CryptoJobsList, Web3.career, Twitter",
  },
  { id: "vertical2", label: "General (HN)", hint: "Hacker News, driven by your search configs" },
  { id: "vertical3", label: "Card affiliate", hint: "Seeded agency websites + Twitter" },
];

export function DiscoveryRunPanel() {
  const { run, busy, runVertical } = useDiscoveryRun();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {VERTICALS.map((v) => (
          <Button
            key={v.id}
            type="button"
            size="sm"
            title={v.hint}
            disabled={busy !== null}
            onClick={() => runVertical(v.id)}
          >
            {busy === v.id ? "Running…" : `Run ${v.label}`}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Runs the connectors for that vertical right now and writes matches directly into this database, same as{" "}
        <code className="text-foreground">npm run run:{run?.vertical ?? "vertical1"}</code> or the scheduled GitHub
        Action. Progress below is streamed live from the run itself.
      </p>

      {run && <DiscoveryRunProgress run={run} />}
    </div>
  );
}
