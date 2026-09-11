"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/**
 * Lets a provider's key be entered from the Integrations page instead of an
 * env var. Never receives or renders the decrypted value back — only whether
 * a key is present ("env" rows are read-only here, since an env var always
 * wins over a database one; see lib/ai/client.ts's resolveApiKey).
 */
export function ProviderSecretForm({
  providerKey,
  category,
  source,
}: {
  providerKey: string;
  category: "lead_data" | "ai";
  source: "env" | "database" | "none";
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (source === "env") {
    return <p className="text-xs text-muted-foreground">Set via environment variable.</p>;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/provider-secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerKey, category, value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to save key.");
      return;
    }
    setValue("");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  async function onRemove() {
    setError(null);
    const res = await fetch("/api/provider-secrets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to remove key.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {source === "database" ? "Update key" : "Add key"}
        </Button>
        {source === "database" && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onRemove}>
            Remove
          </Button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="flex items-center gap-2">
      <Input
        type="password"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste API key"
        className="w-48"
      />
      <Button type="submit" size="sm" disabled={pending || !value.trim()}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
