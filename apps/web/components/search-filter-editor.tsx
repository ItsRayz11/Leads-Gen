"use client";

import { Input, Select } from "./ui/input";
import { MultiSelect } from "./ui/multi-select";
import { Badge } from "./ui/badge";
import { LiveSearchProviderPicker } from "./live-search-provider-picker";
import { useFilterOptions } from "../lib/hooks/use-filter-options";
import {
  FILTER_LABELS,
  TIERS,
  STATUSES,
  FRESHNESS_VALUES,
  SIGNAL_TYPES,
  VERTICALS,
  type StructuredSearchFilters,
} from "../lib/ai/search-filters";

type ArrayFieldKey = Exclude<keyof StructuredSearchFilters, "minScore" | "vertical" | "liveSearchProviders">;

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

  const liveOptions = useFilterOptions();

  const arrayFields: {
    key: ArrayFieldKey;
    placeholder: string;
    options: readonly string[];
    allowCustom: boolean;
    /** Whether `options` still depends on the /api/filter-options fetch resolving. */
    liveBacked?: boolean;
  }[] = [
    { key: "keywords", placeholder: "community manager, discord", options: [], allowCustom: true },
    {
      key: "roleKeywords",
      placeholder: "head of community",
      options: liveOptions.roleKeywords,
      allowCustom: true,
      liveBacked: true,
    },
    {
      key: "industries",
      placeholder: "defi, gaming",
      options: liveOptions.industries,
      allowCustom: true,
      liveBacked: true,
    },
    {
      key: "countries",
      placeholder: "Singapore, Vietnam",
      options: liveOptions.countries,
      allowCustom: true,
      liveBacked: true,
    },
    {
      key: "regions",
      placeholder: "Southeast Asia",
      options: liveOptions.regions,
      allowCustom: true,
      liveBacked: true,
    },
    { key: "signalTypes", placeholder: "hiring, launch", options: SIGNAL_TYPES, allowCustom: true },
    {
      key: "serviceTypes",
      placeholder: "community management",
      options: liveOptions.serviceTypes,
      allowCustom: true,
      liveBacked: true,
    },
    {
      key: "companySizes",
      placeholder: "1-10, 11-50",
      options: liveOptions.companySizes,
      allowCustom: true,
      liveBacked: true,
    },
    { key: "tiers", placeholder: TIERS.join(", "), options: TIERS, allowCustom: false },
    { key: "statuses", placeholder: "new, qualified", options: STATUSES, allowCustom: false },
    { key: "freshness", placeholder: "fresh, recent", options: FRESHNESS_VALUES, allowCustom: false },
    {
      key: "excludeKeywords",
      placeholder: "internship, unpaid",
      options: liveOptions.excludeKeywords,
      allowCustom: true,
      liveBacked: true,
    },
  ];

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Structured filters</span>
        {source === "ai" && <Badge variant="primary">AI-interpreted</Badge>}
        {source === "keyword_fallback" && <Badge variant="warning">Keyword fallback</Badge>}
      </div>
      {note && <p className="text-xs text-warning">{note}</p>}
      {liveOptions.error && (
        <p className="text-xs text-muted-foreground">
          Couldn&apos;t load live option values ({liveOptions.error}) — showing the built-in list only.
        </p>
      )}

      <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
        <label className="text-xs font-medium">{FILTER_LABELS.vertical} — which pipeline can act on this</label>
        <Select
          className="w-full"
          value={filters.vertical ?? ""}
          onChange={(e) => set("vertical", e.target.value || null)}
        >
          <option value="">Not set — can only be saved/previewed, not run as a discovery pipeline</option>
          {VERTICALS.map((v) => (
            <option key={v} value={v}>
              {v.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        {!filters.vertical && (
          <p className="text-xs text-muted-foreground">
            {source === "keyword_fallback"
              ? `No AI provider is configured, so this was matched by keyword only, which can't judge which pipeline fits. Configure one on the Integrations page for a real match, or pick`
              : `The AI couldn't match this request to one of the ${VERTICALS.length} pipelines this app can actually run (${VERTICALS.map((v) => v.replace(/_/g, " ")).join(", ")}). Pick`}{" "}
            the closest one above to enable Run, or leave it blank to only save the search / preview against
            existing leads.
          </p>
        )}
      </div>

      {filters.vertical === "live_search" && (
        <LiveSearchProviderPicker
          value={filters.liveSearchProviders}
          onChange={(next) => set("liveSearchProviders", next)}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {arrayFields.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{FILTER_LABELS[field.key]}</label>
            <MultiSelect
              options={field.options}
              allowCustom={field.allowCustom}
              loading={Boolean(field.liveBacked) && liveOptions.loading}
              value={filters[field.key]}
              placeholder={field.placeholder}
              onChange={(next) => set(field.key, next)}
            />
          </div>
        ))}

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
      <p className="text-xs text-muted-foreground">
        Not every source can act on every field — Hacker News, for instance, has no industry or location data, so
        it treats Industry as an extra keyword and ignores Geography entirely rather than pretending to filter on
        it. See the <span className="text-foreground">Sources</span> panel on this page for what each connector
        actually supports before running a search.
      </p>
    </div>
  );
}
