"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "./ui/button";
import type { StructuredSearchFilters } from "../lib/ai/search-filters";

/**
 * Row actions for a saved search: run its filters against the existing leads
 * (logging the run to `search_history`), re-run its interpretation (useful
 * after configuring an AI provider, when the original one fell back to
 * keywords), promote it into a workers-pipeline discovery config, or delete it.
 */
export function SavedSearchActions({
  id,
  queryText,
  vertical,
  hasFilters,
}: {
  id: string;
  queryText: string | null;
  vertical: string | null;
  hasFilters: boolean;
}) {
  const [busy, setBusy] = useState<"run" | "interpret" | "promote" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function onRun() {
    setBusy("run");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/saved-searches/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not run this search.");
        return;
      }
      if (data.resultsCount === 0) {
        setMessage(
          vertical
            ? `0 matching leads yet in this pipeline's collected data — try "Add to discovery pipeline" to have it start collecting for these filters.`
            : `0 matching leads — this search has no vertical, so it can only search leads other pipelines already collected. Try "Re-interpret" and pick a vertical, or use "Add to discovery pipeline" once one is set.`
        );
      } else {
        setMessage(`${data.resultsCount} matching lead(s), ${data.qualifiedCount} already qualified or later.`);
      }
      refresh();
      router.push(data.href);
    } finally {
      setBusy(null);
    }
  }

  async function onReinterpret() {
    if (!queryText) {
      setError("No original query text saved for this search.");
      return;
    }
    setBusy("interpret");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/saved-searches/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryText, vertical }),
      });
      const data = (await res.json()) as {
        filters?: StructuredSearchFilters;
        source?: string;
        note?: string;
        error?: string;
      };
      if (!res.ok || !data.filters) {
        setError(data.error ?? "Interpretation failed.");
        return;
      }

      const patch = await fetch(`/api/saved-searches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: data.filters, vertical: data.filters.vertical ?? vertical }),
      });
      if (!patch.ok) {
        setError((await patch.json()).error ?? "Could not save the new filters.");
        return;
      }
      setMessage(data.source === "ai" ? "Re-interpreted with AI." : data.note ?? "Keyword fallback applied.");
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onPromote() {
    setBusy("promote");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/saved-searches/${id}/discovery-config`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create a discovery config.");
        return;
      }
      setMessage("Added as an enabled discovery config.");
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json()).error ?? "Could not delete.");
        return;
      }
      refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          disabled={busy !== null || !hasFilters}
          onClick={onRun}
          title={
            hasFilters
              ? "Search leads already collected in the database — does not go fetch new ones"
              : "Interpret this search first"
          }
        >
          {busy === "run" ? "…" : "Search existing leads"}
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={busy !== null} onClick={onReinterpret}>
          {busy === "interpret" ? "…" : "Re-interpret"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy !== null || !hasFilters}
          onClick={onPromote}
          title={
            hasFilters
              ? "Register these filters so the discovery pipeline collects matching leads going forward"
              : "Interpret this search first"
          }
        >
          {busy === "promote" ? "…" : "Add to discovery pipeline"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={onDelete}>
          Delete
        </Button>
      </div>
      {message && <p className="text-xs text-success">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
