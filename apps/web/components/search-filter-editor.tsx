"use client";

import { Input, Select } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  FILTER_LABELS,
  TIERS,
  VERTICALS,
  type StructuredSearchFilters,
} from "../lib/ai/search-filters";

const ARRAY_FIELDS: {
  key: Exclude<keyof StructuredSearchFilters, "minScore" | "vertical">;
  placeholder: string;
}[] = [
  { key: "keywords", placeholder: "community manager, discord" },
  { key: "roleKeywords", placeholder: "head of community" },
  { key: "industries", placeholder: "defi, gaming" },
  { key: "countries", placeholder: "Singapore, Vietnam" },
  { key: "regions", placeholder: "Southeast Asia" },
  { key: "signalTypes", placeholder: "hiring, launch" },
  { key: "serviceTypes", placeholder: "community management" },
  { key: "companySizes", placeholder: "1-10, 11-50" },
  { key: "tiers", placeholder: TIERS.join(", ") },
  { key: "statuses", placeholder: "new, qualified" },
  { key: "freshness", placeholder: "fresh, recent" },
  { key: "excludeKeywords", placeholder: "internship, unpaid" },
];

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Renders interpreted filters as editable fields. The interpretation is a
 * starting point, not a verdict — every field stays hand-correctable before
 * the search is saved, and only values kept here are what actually run.
 */
export function SearchFilterEditor({
  filters,
  onChange,
  source,
  note,
}: {
  filters: StructuredSearchFilters;
  onChange: (next: StructuredSearchFilters) => void;
  source?: "ai" | "keyword_fallback" | null;
  note?: string | null;
}) {
  function set<K extends keyof StructuredSearchFilters>(key: K, value: StructuredSearchFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Structured filters</span>
        {source === "ai" && <Badge variant="primary">AI-interpreted</Badge>}
        {source === "keyword_fallback" && <Badge variant="warning">Keyword fallback</Badge>}
      </div>
      {note && <p className="text-xs text-warning">{note}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ARRAY_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{FILTER_LABELS[field.key]}</label>
            <Input
              value={filters[field.key].join(", ")}
              placeholder={field.placeholder}
              onChange={(e) => set(field.key, parseList(e.target.value))}
            />
          </div>
        ))}

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{FILTER_LABELS.vertical}</label>
          <Select
            className="w-full"
            value={filters.vertical ?? ""}
            onChange={(e) => set("vertical", e.target.value || null)}
          >
            <option value="">Any</option>
            {VERTICALS.map((v) => (
              <option key={v} value={v}>
                {v.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{FILTER_LABELS.minScore}</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={filters.minScore ?? ""}
            placeholder="e.g. 70"
            onChange={(e) => set("minScore", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Comma-separated. Every field maps to a real column — keywords match the lead title, signal summary and
        qualification notes; exclusions match the title only.
      </p>
    </div>
  );
}
