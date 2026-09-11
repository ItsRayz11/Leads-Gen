"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input, Select, Textarea } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { SearchFilterEditor } from "./search-filter-editor";
import {
  EMPTY_FILTERS,
  filtersToSearchParams,
  isFiltersEmpty,
  type StructuredSearchFilters,
} from "../lib/ai/search-filters";
import type { UseCaseStatus } from "../lib/data/ai-settings";

type InterpretSource = "ai" | "keyword_fallback";

interface InterpretResponse {
  filters: StructuredSearchFilters;
  source: InterpretSource;
  provider?: string;
  model?: string;
  note?: string;
  error?: string;
}

/**
 * Two-step by design: interpret the natural-language query into structured
 * filters, let them be reviewed and corrected, then save. Saving raw text
 * alone would leave a search nothing can actually run.
 */
export function SavedSearchForm({ aiStatus }: { aiStatus?: UseCaseStatus }) {
  const [queryText, setQueryText] = useState("");
  const [vertical, setVertical] = useState("");
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<StructuredSearchFilters>(EMPTY_FILTERS);
  const [source, setSource] = useState<InterpretSource | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const interpreted = source !== null;

  async function onInterpret() {
    if (!queryText.trim()) return;
    setInterpreting(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-searches/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryText, vertical: vertical || null }),
      });
      const data = (await res.json()) as InterpretResponse;
      if (!res.ok) {
        setError(data.error ?? "Could not interpret that query.");
        return;
      }
      setFilters(data.filters);
      setSource(data.source);
      setNote(
        data.note ?? (data.source === "ai" ? `Interpreted by ${data.provider} (${data.model}).` : null)
      );
      if (!name.trim()) setName(queryText.slice(0, 80));
    } catch {
      setError("Could not reach the interpretation endpoint.");
    } finally {
      setInterpreting(false);
    }
  }

  async function onSave() {
    if (!name.trim() && !queryText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || queryText.slice(0, 80),
          queryText,
          filters,
          vertical: filters.vertical ?? vertical ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not save this search.");
        return;
      }
      setQueryText("");
      setName("");
      setFilters(EMPTY_FILTERS);
      setSource(null);
      setNote(null);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  const previewHref = `/leads?${filtersToSearchParams(filters).toString()}`;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">What type of leads are you looking for?</label>
      <Textarea
        rows={2}
        placeholder="e.g. crypto projects in Southeast Asia hiring community managers, exclude unpaid internships"
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={vertical} onChange={(e) => setVertical(e.target.value)}>
          <option value="">Let AI decide the vertical</option>
          <option value="hiring">Hiring</option>
          <option value="general">General</option>
          <option value="card_affiliate">Card affiliate</option>
        </Select>
        <Button type="button" size="sm" disabled={interpreting || !queryText.trim()} onClick={onInterpret}>
          {interpreting ? "Interpreting…" : "Interpret into filters"}
        </Button>
        {aiStatus &&
          (aiStatus.ready ? (
            <Badge variant="success">AI ready — {aiStatus.provider}{aiStatus.model ? ` · ${aiStatus.model}` : ""}</Badge>
          ) : aiStatus.reason === "no_key" ? (
            <Badge variant="warning">
              {aiStatus.provider} is assigned but has no API key — will use keyword fallback
            </Badge>
          ) : (
            <Badge variant="outline">No AI provider assigned — will use keyword fallback</Badge>
          ))}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {interpreted && (
        <>
          <SearchFilterEditor filters={filters} onChange={setFilters} source={source} note={note} />

          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-64"
              placeholder="Name this search"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="button" size="sm" disabled={saving || pending} onClick={onSave}>
              {saving ? "Saving…" : "Save this search"}
            </Button>
            {!isFiltersEmpty(filters) && (
              <a href={previewHref} className="text-xs text-primary hover:underline">
                Preview matching leads →
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
