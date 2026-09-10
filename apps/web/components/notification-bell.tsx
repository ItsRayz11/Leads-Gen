"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NotificationTypeBadge } from "./ui/badge";
import { Button } from "./ui/button";
import { timeAgo } from "../lib/utils";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  related_lead_id: string | null;
  read: boolean;
  created_at: string;
  lead: { id: string; title: string; company: { name: string } | null } | null;
}

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
      setRecent(data.recent ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markRead(id: string) {
    setRecent((rows) => rows.map((r) => (r.id === id ? { ...r, read: true } : r)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
  }

  async function markAllRead() {
    setRecent((rows) => rows.map((r) => ({ ...r, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "POST" });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && recent.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No notifications yet.</p>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-border px-3 py-2 text-xs last:border-0 ${
                    n.read ? "" : "bg-accent/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{n.body}</p>}
                      <div className="mt-1 flex items-center gap-1.5">
                        <NotificationTypeBadge type={n.type} />
                        <span className="text-muted-foreground">{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="shrink-0 text-primary hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  {n.related_lead_id && (
                    <Link
                      href={`/leads/${n.related_lead_id}`}
                      onClick={() => setOpen(false)}
                      className="mt-1 inline-block text-primary hover:underline"
                    >
                      {n.lead?.company?.name ?? "View lead"} →
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border px-3 py-2 text-center">
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
