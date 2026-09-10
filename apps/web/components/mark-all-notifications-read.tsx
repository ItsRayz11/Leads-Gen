"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "./ui/button";

export function MarkAllNotificationsRead() {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClick}>
      {busy ? "…" : "Mark all read"}
    </Button>
  );
}
