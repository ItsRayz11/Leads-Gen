"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { TargetCompany, TargetCompanySource } from "@leads/db/types.js";

/**
 * Add/remove UI for one connector's target-company list (Greenhouse board
 * tokens, Lever company slugs, Ashby board names, or seeded agency
 * websites) — the database-backed replacement for hand-editing
 * config/target-companies/*.json, so a company can be added from the
 * Integrations page and take effect on the next run without a redeploy.
 */
export function TargetCompanyList({
  source,
  identifierLabel,
  identifierPlaceholder,
  showTwitterField,
  rows,
}: {
  source: TargetCompanySource;
  identifierLabel: string;
  identifierPlaceholder: string;
  showTwitterField?: boolean;
  rows: TargetCompany[];
}) {
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/target-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          identifier: identifier.trim(),
          label: label.trim() || undefined,
          twitterHandle: showTwitterField ? twitterHandle.trim() || undefined : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add.");
        return;
      }
      setIdentifier("");
      setLabel("");
      setTwitterHandle("");
      startTransition(() => router.refresh());
    } finally {
      setAdding(false);
    }
  }

  async function onRemove(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/target-companies/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to remove.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {rows.length > 0 ? (
        <ul className="divide-y divide-border/60 rounded-md border border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                {row.label && <span className="font-medium">{row.label} — </span>}
                <span className="text-muted-foreground">{row.identifier}</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={removingId === row.id || pending}
                onClick={() => onRemove(row.id)}
              >
                {removingId === row.id ? "Removing…" : "Remove"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">None added yet.</p>
      )}

      <form onSubmit={onAdd} className="flex flex-wrap items-center gap-2">
        <Input
          className="w-48"
          placeholder={identifierPlaceholder}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          aria-label={identifierLabel}
        />
        <Input
          className="w-40"
          placeholder="Display name (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        {showTwitterField && (
          <Input
            className="w-36"
            placeholder="Twitter handle (optional)"
            value={twitterHandle}
            onChange={(e) => setTwitterHandle(e.target.value)}
          />
        )}
        <Button type="submit" size="sm" disabled={adding || !identifier.trim()}>
          {adding ? "Adding…" : "Add"}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </form>
    </div>
  );
}
