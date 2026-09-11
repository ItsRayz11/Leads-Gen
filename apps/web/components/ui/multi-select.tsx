"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
 *
 * Keyboard: ArrowDown/ArrowUp move the active option (opening the list if
 * closed), Home/End jump to either end, Enter takes the active option —
 * falling back to the typed text when custom values are allowed — Escape
 * closes without selecting, and Backspace on an empty input removes the last
 * chip. The combobox/listbox ARIA wiring means a screen reader announces the
 * active option as it changes rather than leaving the list silent.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  allowCustom = true,
  loading = false,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean;
  /** Shows a "Loading options…" row instead of an empty dropdown while options are still being fetched. */
  loading?: boolean;
  className?: string;
  /** Applied to the text input, so an external <label htmlFor> points at the right element. */
  id?: string;
  "aria-label"?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  /** Index into `filtered` of the keyboard-highlighted option, or -1 for none. */
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const optionId = (index: number) => `${reactId}-option-${index}`;

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
  const canAddCustom = query.trim().length > 0 && allowCustom && !exactMatch;

  // Typing changes the list under the highlight, so the old index would point
  // at an unrelated option. Reset it rather than letting Enter pick something
  // the user never looked at.
  useEffect(() => {
    setActiveIndex(-1);
  }, [query, options]);

  // Keep the highlighted option inside the scrollable list.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    listRef.current.querySelector(`#${CSS.escape(optionId(activeIndex))}`)?.scrollIntoView({ block: "nearest" });
    // optionId is derived from a stable id; re-running on index alone is right.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const add = useCallback(
    (raw: string) => {
      const next = raw.trim();
      if (!next) return;
      if (selectedLower.has(next.toLowerCase())) return;
      onChange([...value, next]);
      setQuery("");
      setActiveIndex(-1);
    },
    [onChange, selectedLower, value]
  );

  function remove(item: string) {
    onChange(value.filter((v) => v.toLowerCase() !== item.toLowerCase()));
  }

  function selectAll() {
    onChange([...value, ...filtered]);
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function clearAll() {
    onChange([]);
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function move(delta: number) {
    if (!open) {
      setOpen(true);
      return;
    }
    if (filtered.length === 0) return;
    setActiveIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return filtered.length - 1;
      if (next >= filtered.length) return 0;
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        if (open && filtered.length > 0) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open && filtered.length > 0) {
          e.preventDefault();
          setActiveIndex(filtered.length - 1);
        }
        break;
      case "Enter":
        e.preventDefault();
        // An explicitly highlighted option always wins over the typed text,
        // so arrowing to an option and pressing Enter can't add a near-miss
        // free-text value instead.
        if (activeIndex >= 0 && activeIndex < filtered.length) add(filtered[activeIndex]);
        else if (query.trim() && (allowCustom || exactMatch)) add(query);
        else if (filtered.length > 0) add(filtered[0]);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        }
        break;
      case "Backspace":
        if (query === "" && value.length > 0) remove(value[value.length - 1]);
        break;
      default:
        break;
    }
  }

  const showList = open && (loading || filtered.length > 0 || canAddCustom);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary",
          className
        )}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
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
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label={`Remove ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[6rem] flex-1 bg-transparent py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listboxId : undefined}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          autoComplete="off"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
            className="ml-auto rounded-sm px-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label={`Clear all ${value.length} selected`}
            title="Clear selection"
          >
            Clear
          </button>
        )}
      </div>

      {showList && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-busy={loading}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg"
        >
          {loading && (
            <div className="px-3 py-1.5 text-sm text-muted-foreground" role="status">
              Loading options…
            </div>
          )}
          {!loading && filtered.length > 1 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={selectAll}
              className="block w-full border-b border-border px-3 py-1.5 text-left text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              Select all ({filtered.length})
            </button>
          )}
          {!loading && canAddCustom && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(query)}
              className="block w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
            >
              Add &ldquo;{query.trim()}&rdquo;
            </button>
          )}
          {filtered.map((option, index) => (
            <button
              key={option}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => add(option)}
              className={cn(
                "block w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent",
                index === activeIndex && "bg-accent"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
