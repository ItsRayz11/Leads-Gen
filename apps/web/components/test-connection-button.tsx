"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "./ui/button";

export function TestConnectionButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onClick() {
    setError(null);
    const res = await fetch("/api/ai-provider-settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Test failed.");
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClick}>
        {pending ? "Testing…" : "Test connection"}
      </Button>
      {error && <span className="max-w-xs text-xs text-destructive">{error}</span>}
    </div>
  );
}
