"use client";

import { Input, Select } from "./ui/input";
import { MultiSelect } from "./ui/multi-select";
import { Badge } from "./ui/badge";
import {
  FILTER_LABELS,
  TIERS,
  STATUSES,
  FRESHNESS_VALUES,
  INDUSTRIES,
  COUNTRIES,
  SIGNAL_TYPES,
  COMPANY_SIZES,
  VERTICALS,
  type StructuredSearchFilters,
} from "../lib/ai/search-filters";

const ARRAY_FIELDS: {
  key: Exclude<keyof StructuredSearchFilters, "minScore" | "vertical">;
  placeholder: string;
  options: readonly string[];
  allowCustom: boolean;
}[] = [
  { key: "keywords", placeholder: "community manager, discord", options: [], allowCustom: true },
  { key: "roleKeywords", placeholder: "head of community", options: [], allowCustom: true },
  { key: "industries", placeholder: "defi, gaming", options: INDUSTRIES, allowCustom: true },
  { key: "countries", placeholder: "Singapore, Vietnam", options: COUNTRIES, allowCustom: true },
  { key: "regions", placeholder: "Southeast Asia", options: [], allowCustom: true },
  { key: "signalTypes", placeholder: "hiring, launch", options: SIGNAL_TYPES, allowCustom: true },
  { key: "serviceTypes", placeholder: "community management", options: [], allowCustom: true },
  { key: "companySizes", placeholder: "1-10, 11-50", options: COMPANY_SIZES, allowCustom: true },
  { key: "tiers", placeholder: TIERS.join(", "), options: TIERS, allowCustom: false },
  { key: "statuses", placeholder: "new, qualified", options: STATUSES, allowCustom: false },
  { key: "freshness", placeholder: "fresh, recent", options: FRESHNESS_VALUES, allowCustom: false },
  { key: "excludeKeywords", placeholder: "internship, unpaid", options: [], allowCustom: true },
];

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
            <MultiSelect
              options={field.options}
              allowCustom={field.allowCustom}
              value={filters[field.key]}
              placeholder={field.placeholder}
              onChange={(next) => set(field.key, next)}
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
        Click a field to pick from its list, or type and press Enter to add your own. Every field maps to a real
        column — keywords match the lead title, signal summary and qualification notes; exclusions match the title
        only.
      </p>
    </div>
  );
}
