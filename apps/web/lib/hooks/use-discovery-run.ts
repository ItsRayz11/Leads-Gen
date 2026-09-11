"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProgressEvent, RunResult } from "@leads/workers";
import { readEventStream } from "../sse";

export type Vertical = "vertical1" | "vertical2" | "vertical3" | "vertical4";

/** A connector's live state within the run currently on screen. */
export type ConnectorState = {
  connector: string;
  status: "running" | "done" | "error" | "skipped";
  signalsFound?: number;
  note?: string;
  error?: string;
};

export type RunState = {
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

/**
 * Drives one `/api/discovery/run` SSE call and exposes its live state.
 * Shared by the "Run discovery now" panel (fixed per-vertical buttons) and
 * the New Search form (a freshly interpreted query run immediately) so both
 * get the exact same streaming/progress behavior.
 */
export function useDiscoveryRun() {
  const [busy, setBusy] = useState<Vertical | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // A run writes real rows; if the component unmounts we stop reading the
  // stream but deliberately don't try to cancel the work server-side.
  useEffect(() => () => abortRef.current?.abort(), []);

  const runVertical = useCallback(
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

  return { run, busy, runVertical };
}
