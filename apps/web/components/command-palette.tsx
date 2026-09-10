"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { NAV } from "./sidebar";
import type { SearchResponse } from "../app/api/search/route";

interface ResultItem {
  key: string;
  label: string;
  sublabel: string | null;
  href: string;
  group: string;
}

const NAV_ITEMS: { label: string; href: string }[] = NAV.flatMap((section) =>
  section.items.map((item) => ({ label: item.label, href: item.href }))
);

const EMPTY_RESULTS: SearchResponse = { companies: [], leads: [], contacts: [] };

const OPEN_EVENT = "command-palette:open";

/** Lets the header's search button open the palette without lifting its open state into a shared context. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(EMPTY_RESULTS);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(EMPTY_RESULTS);
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setResults(await res.json());
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  const navMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  const items = useMemo<ResultItem[]>(() => {
    const list: ResultItem[] = navMatches.map((item) => ({
      key: `nav:${item.href}`,
      label: item.label,
      sublabel: null,
      href: item.href,
      group: "Go to",
    }));
    for (const c of results.companies) {
      list.push({ key: `company:${c.id}`, label: c.name, sublabel: c.domain, href: `/companies/${c.id}`, group: "Companies" });
    }
    for (const l of results.leads) {
      list.push({
        key: `lead:${l.id}`,
        label: `${l.companyName} — ${l.title}`,
        sublabel: l.status.replace(/_/g, " "),
        href: `/leads/${l.id}`,
        group: "Leads",
      });
    }
    for (const c of results.contacts) {
      list.push({
        key: `contact:${c.id}`,
        label: c.name,
        sublabel: [c.job_title, c.company?.name].filter(Boolean).join(" · ") || null,
        href: `/contacts/${c.id}`,
        group: "Contacts",
      });
    }
    return list;
  }, [navMatches, results]);

  useEffect(() => setActiveIndex(0), [items.length, query]);

  function select(item: ResultItem) {
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) select(item);
    }
  }

  if (!open) return null;

  let groupCursor = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search companies, leads, contacts, or jump to a page…"
            className="h-11 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-96 overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matches.</p>
          ) : (
            items.map((item, index) => {
              const showGroupHeader = item.group !== groupCursor;
              groupCursor = item.group;
              return (
                <div key={item.key}>
                  {showGroupHeader && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                      {item.group}
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(item)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                      index === activeIndex ? "bg-accent text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.sublabel && <span className="shrink-0 text-xs text-muted-foreground">{item.sublabel}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
