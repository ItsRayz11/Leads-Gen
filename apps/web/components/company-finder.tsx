"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Source = "greenhouse" | "lever" | "ashby";

interface Match {
  source: Source;
  identifier: string;
  jobCount: number;
}

const SOURCE_LABELS: Record<Source, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
};

/**
 * Lets the user type a plain company name instead of hunting down its
 * Greenhouse board token / Lever slug / Ashby board name by hand — hits
 * /api/target-companies/resolve, which guesses at the slug and checks each
 * provider's public API, then adds whichever match the user picks via the
 * same POST /api/target-companies the manual forms below use.
 */
export function CompanyFinder() {
  const [name, setName] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = name.trim();
    if (!query) return;
    setSearching(true);
    setError(null);
    setMatches(null);
    try {
      const res = await fetch(`/api/target-companies/resolve?name=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
        return;
      }
      setMatches(data.matches ?? []);
    } catch {
      setError("Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function onAdd(match: Match) {
    const key = `${match.source}:${match.identifier}`;
    setAddingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/target-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: match.source, identifier: match.identifier, label: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add.");
        return;
      }
      setAddedKeys((prev) => new Set(prev).add(key));
      router.refresh();
    } finally {
      setAddingKey(null);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-accent/30 p-3">
      <p className="text-sm font-medium">Find a company</p>
      <p className="text-xs text-muted-foreground">
        Type a company name and this checks Greenhouse, Lever, and Ashby for a public job board under that name — no
        more hunting down the exact token yourself.
      </p>
      <form onSubmit={onSearch} className="flex flex-wrap items-center gap-2">
        <Input
          className="w-56"
          placeholder="Company name (e.g. Acme)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={searching || !name.trim()}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {matches !== null &&
        (matches.length > 0 ? (
          <ul className="divide-y divide-border/60 rounded-md border border-border bg-background">
            {matches.map((m) => {
              const key = `${m.source}:${m.identifier}`;
              const added = addedKeys.has(key);
              return (
                <li key={key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{SOURCE_LABELS[m.source]}</span>{" "}
                    <span className="text-muted-foreground">
                      {m.identifier} — {m.jobCount} open role{m.jobCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={added ? "ghost" : "default"}
                    disabled={added || addingKey === key}
                    onClick={() => onAdd(m)}
                  >
                    {added ? "Added" : addingKey === key ? "Adding…" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No public Greenhouse, Lever, or Ashby board found under that name — try a shorter or different spelling,
            or add it manually below if you already know the exact token/slug.
          </p>
        ))}
    </div>
  );
}
