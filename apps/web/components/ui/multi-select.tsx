"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * A dropdown, click-to-select field for an array of strings. When `options`
 * is non-empty it behaves like a searchable multi-select combobox (click or
 * type to filter, click to toggle); when empty (or `allowCustom` finds no
 * match) typing + Enter adds a free-text chip instead. Every structured
 * filter field uses this one component so they all feel the same, whether
 * the field has a closed list (industries, countries, tiers, ...) or is
 * inherently open-ended (keywords, roles).
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  allowCustom = true,
  loading = false,
  className,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean;
  /** Shows a "Loading options…" row instead of an empty dropdown while options are still being fetched. */
  loading?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedLower = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !selectedLower.has(o.toLowerCase()) && (!q || o.toLowerCase().includes(q)));
  }, [options, query, selectedLower]);

  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  function add(raw: string) {
    const next = raw.trim();
    if (!next) return;
    if (selectedLower.has(next.toLowerCase())) return;
    onChange([...value, next]);
    setQuery("");
  }

  function remove(item: string) {
    onChange(value.filter((v) => v.toLowerCase() !== item.toLowerCase()));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (query.trim() && (allowCustom || exactMatch)) add(query);
      else if (filtered.length > 0) add(filtered[0]);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 focus-within:ring-1 focus-within:ring-primary",
          className
        )}
        onClick={() => setOpen(true)}
      >
        {value.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
          >
            {item}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(item);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[6rem] flex-1 bg-transparent py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {open && (loading || filtered.length > 0 || (query.trim() && allowCustom && !exactMatch)) && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-md">
          {loading && (
            <div className="px-3 py-1.5 text-sm text-muted-foreground">Loading options…</div>
          )}
          {!loading && query.trim() && allowCustom && !exactMatch && (
            <button
              type="button"
              onClick={() => add(query)}
              className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-accent"
            >
              Add "{query.trim()}"
            </button>
          )}
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => add(option)}
              className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-accent"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
