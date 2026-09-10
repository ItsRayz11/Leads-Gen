import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FRESHNESS_DAYS = { fresh: 7, recent: 30, aging: 90 } as const;

export function freshnessFromDate(date: string | Date | null | undefined): string {
  if (!date) return "unknown";
  const days = (Date.now() - new Date(date).getTime()) / 86_400_000;
  if (days <= FRESHNESS_DAYS.fresh) return "fresh";
  if (days <= FRESHNESS_DAYS.recent) return "recent";
  if (days <= FRESHNESS_DAYS.aging) return "aging";
  return "stale";
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const seconds = (Date.now() - new Date(date).getTime()) / 1000;
  if (seconds < 60) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.floor(days)}d ago`;
  const months = days / 30;
  if (months < 12) return `${Math.floor(months)}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
