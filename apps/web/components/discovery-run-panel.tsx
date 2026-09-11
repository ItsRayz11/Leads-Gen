"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ProgressEvent, RunResult } from "@leads/workers";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { readEventStream } from "../lib/sse";
import { cn } from "../lib/utils";

type Vertical = "vertical1" | "vertical2" | "vertical3";

const VERTICALS: { id: Vertical; label: string; hint: string }[] = [
  {
    id: "vertical1",
    label: "Hiring signals",
    hint: "Greenhouse, Lever, Ashby, CryptoJobsList, Web3.career, Twitter",
  },
  { id: "vertical2", label: "General (HN)", hint: "Hacker News, driven by your search configs" },
  { id: "vertical3", label: "Card affiliate", hint: "Seeded agency websites + Twitter" },
];

/** A connector's live state within the run currently on screen. */
type ConnectorState = {
  connector: string;
  status: "running" | "done" | "error" | "skipped";
  signalsFound?: number;
  note?: string;
  error?: string;
};

type RunState = {
  vertical: Vertical;
  /** Ordered list of stage messages already reached. */
  stages: { stage: string; message: string }[];
  connectors: ConnectorState[];
  leads: { companyName: string; score: number }[];
  leadTotal: number;
  result: RunResult | null;
  error: string | null;
  finished: boolean;
};

function emptyRun(vertical: Vertical): RunState {
  return {
    vertical,
    stages: [],
    connectors: [],
    leads: [],
    leadTotal: 0,
    result: null,
    error: null,
    finished: false,
  };
}

/** Applies one streamed event to the run state. Pure, so it stays easy to reason about. */
function reduce(state: RunState, event: ProgressEvent): RunState {
  switch (event.type) {
    case "stage":
      return { ...state, stages: [...state.stages, { stage: event.stage, message: event.message }] };
    case "connector:start":
      return { ...state, connectors: [...state.connectors, { connector: event.connector, status: "running" }] };
    case "connector:done":
      return {
        ...state,
        connectors: state.connectors.map((c) =>
          c.connector === event.connector && c.status === "running"
            ? { ...c, status: "done", signalsFound: event.signalsFound, note: event.note }
            : c
        ),
      };
    case "connector:error":
      return {
        ...state,
        connectors: state.connectors.map((c) =>
          c.connector === event.connector && c.status === "running"
            ? { ...c, status: "error", error: event.error }
            : c
        ),
      };
    case "connector:skipped":
      return {
        ...state,
        connectors: [...state.connectors, { connector: event.connector, status: "skipped", note: event.reason }],
      };
    case "lead":
      return {
        ...state,
        leadTotal: event.total,
        leads: [...state.leads, { companyName: event.companyName, score: event.score }],
      };
    case "result":
      return { ...state, result: event.result, finished: true };
    case "error":
      return { ...state, error: event.error, finished: true };
    default:
      return state;
  }
}

const STATUS_ICON: Record<ConnectorState["status"], string> = {
  running: "⟳",
  done: "✓",
  error: "✕",
  skipped: "–",
};

function ConnectorRow({ state }: { state: ConnectorState }) {
  return (
    <li className="flex items-start gap-2 py-1">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 w-3 shrink-0 text-center font-mono text-xs",
          state.status === "running" && "animate-spin text-primary",
          state.status === "done" && "text-success",
          state.status === "error" && "text-destructive",
          state.status === "skipped" && "text-muted-foreground"
        )}
      >
        {STATUS_ICON[state.status]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground">{state.connector}</span>
        {state.status === "done" && (
          <span className="text-muted-foreground"> &mdash; {state.signalsFound} signal(s)</span>
        )}
        {state.status === "running" && <span className="text-muted-foreground"> &mdash; searching&hellip;</span>}
        {state.status === "skipped" && (
          <span className="text-muted-foreground"> &mdash; skipped ({state.note})</span>
        )}
        {state.note && state.status === "done" && <span className="block text-warning">{state.note}</span>}
        {state.error && <span className="block break-words text-destructive">{state.error}</span>}
      </span>
    </li>
  );
}

export function DiscoveryRunPanel() {
  const [busy, setBusy] = useState<Vertical | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // A run writes real rows; if the component unmounts we stop reading the
  // stream but deliberately don't try to cancel the work server-side.
  useEffect(() => () => abortRef.current?.abort(), []);

  const onRun = useCallback(
    async (vertical: Vertical) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(vertical);
      setRun(emptyRun(vertical));

      try {
        const res = await fetch("/api/discovery/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vertical }),
          signal: controller.signal,
        });

        // Auth/validation failures still answer with plain JSON, not a stream.
        if (!res.ok || !res.body || !res.headers.get("content-type")?.includes("text/event-stream")) {
          const message = await res
            .json()
            .then((d: { error?: string }) => d.error)
            .catch(() => null);
          setRun((prev) =>
            prev ? { ...prev, error: message ?? `Discovery run failed (${res.status}).`, finished: true } : prev
          );
          return;
        }

        await readEventStream<ProgressEvent>(
          res.body,
          (event) => setRun((prev) => (prev ? reduce(prev, event) : prev)),
          controller.signal
        );

        // The stream ended without a terminal event &mdash; a serverless timeout
        // looks exactly like this, and saying so beats a spinner that stops.
        setRun((prev) =>
          prev && !prev.finished
            ? {
                ...prev,
                finished: true,
                error:
                  "The connection closed before the run reported a result. Any leads already found were saved — reload to see them. If this keeps happening, run the pipeline from the CLI or the scheduled GitHub Action instead.",
              }
            : prev
        );
        startTransition(() => router.refresh());
      } catch (err) {
        if (controller.signal.aborted) return;
        setRun((prev) =>
          prev
            ? { ...prev, finished: true, error: err instanceof Error ? err.message : "Discovery run failed." }
            : prev
        );
      } finally {
        if (!controller.signal.aborted) setBusy(null);
      }
    },
    [router]
  );

  const result = run?.result ?? null;
  const active = run !== null && !run.finished;
  const failedConnectors = run?.connectors.filter((c) => c.status === "error").length ?? 0;

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
            onClick={() => onRun(v.id)}
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

      {run && (
        <div
          className={cn(
            "space-y-3 rounded-md border p-3 text-xs",
            run.error ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30"
          )}
        >
          <ol className="space-y-0.5" aria-live="polite" aria-busy={active ? "true" : "false"}>
            {run.stages.map((s, i) => {
              const pending = i === run.stages.length - 1 && active;
              return (
                <li key={`${s.stage}-${i}`} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 w-3 shrink-0 text-center font-mono",
                      pending ? "animate-spin text-primary" : "text-success"
                    )}
                  >
                    {pending ? "⟳" : "✓"}
                  </span>
                  <span className="text-foreground">{s.message}</span>
                </li>
              );
            })}
          </ol>

          {run.connectors.length > 0 && (
            <div>
              <p className="mb-1 font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
              <ul className="divide-y divide-border/60">
                {run.connectors.map((c, i) => (
                  <ConnectorRow key={`${c.connector}-${i}`} state={c} />
                ))}
              </ul>
            </div>
          )}

          {run.leads.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium uppercase tracking-wide text-muted-foreground">Leads</p>
                <span className="text-muted-foreground">
                  {run.leads.length}
                  {run.leadTotal > 0 && ` / ${run.leadTotal}`}
                </span>
              </div>
              {run.leadTotal > 0 && (
                <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round((run.leads.length / run.leadTotal) * 100)}%` }}
                  />
                </div>
              )}
              <ul className="space-y-0.5 text-muted-foreground">
                {run.leads
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 10)
                  .map((l) => (
                    <li key={l.companyName}>
                      [{l.score}] {l.companyName}
                    </li>
                  ))}
                {run.leads.length > 10 && <li>&hellip;and {run.leads.length - 10} more</li>}
              </ul>
            </div>
          )}

          {run.error && <p className="text-destructive">{run.error}</p>}

          {result && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <Badge
                variant={
                  result.status === "failed"
                    ? "destructive"
                    : result.status === "completed_with_warnings"
                      ? "warning"
                      : "success"
                }
              >
                {(result.status ?? "completed").replace(/_/g, " ")}
              </Badge>
              <span className="text-foreground">
                {result.signalsFound} signal(s) found, {result.leadsUpserted.length} lead(s) upserted
                {failedConnectors > 0 && `, ${failedConnectors} source(s) failed`}
              </span>
              {result.note && <span className="w-full text-warning">{result.note}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
