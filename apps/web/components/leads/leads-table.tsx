"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input, Select } from "../ui/input";
import {
  Badge,
  FreshnessBadge,
  StatusBadge,
  TierBadge,
  VerificationBadge,
} from "../ui/badge";
import { cn, formatDate } from "../../lib/utils";
import {
  COLUMN_LAYOUT_STORAGE_KEY,
  LEAD_COLUMNS,
  PAGE_SIZES,
  defaultColumnVisibility,
  mergeColumnVisibility,
  type LeadColumn,
  type LeadListRow,
  type SortDirection,
} from "../../lib/leads-table";
import {
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  LEAD_TIERS,
  LEAD_VERTICALS,
  VERIFICATION_STATUSES,
  VERTICAL_LABELS,
  humanize,
} from "../../lib/lead-options";

export interface LeadsTableProps {
  rows: LeadListRow[];
  /** Total matching rows in the database, for the pager and the row count. */
  total: number;
  page: number;
  perPage: number;
  sort: string;
  dir: SortDirection;
  /** The page's current query string, so links preserve unrelated params. */
  searchParams: string;
  quickFilters: { q: string; status: string; tier: string; vertical: string };
  /** Shown instead of rows — the caller knows whether "none" means "none yet" or "none matching". */
  emptyMessage: string;
}

export function LeadsTable({
  rows,
  total,
  page,
  perPage,
  sort,
  dir,
  searchParams,
  quickFilters,
  emptyMessage,
}: LeadsTableProps) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();

  // Starts at the defaults so the server and first client render agree; the
  // saved layout is read in an effect afterwards.
  const [visibility, setVisibility] = useState<Record<string, boolean>>(defaultColumnVisibility);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ tone: "error" | "success"; text: string } | null>(
    null
  );
  const [followUpDate, setFollowUpDate] = useState("");
  const [search, setSearch] = useState(quickFilters.q);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMN_LAYOUT_STORAGE_KEY);
      if (raw) setVisibility(mergeColumnVisibility(JSON.parse(raw)));
    } catch {
      // A corrupt or unavailable layout just means the default columns.
    }
  }, []);

  useEffect(() => {
    if (!columnsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [columnsOpen]);

  // Selecting rows and then paging/sorting/filtering would leave a selection
  // pointing at leads that are no longer on screen, so a changed row set
  // clears it.
  const rowSignature = rows.map((row) => row.id).join(",");
  useEffect(() => {
    setSelected(new Set());
  }, [rowSignature]);

  useEffect(() => {
    setSearch(quickFilters.q);
  }, [quickFilters.q]);

  const visibleColumns = useMemo(
    () => LEAD_COLUMNS.filter((column) => visibility[column.key]),
    [visibility]
  );

  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      mutate(params);
      const query = params.toString();
      startNavigation(() => router.push(query ? `/leads?${query}` : "/leads"));
    },
    [router, searchParams]
  );

  /** Any change to what is being listed sends you back to the first page. */
  const setFilterParam = useCallback(
    (key: string, value: string) => {
      navigate((params) => {
        if (value) params.set(key, value);
        else params.delete(key);
        params.delete("page");
      });
    },
    [navigate]
  );

  function onSortClick(column: LeadColumn) {
    if (!column.sortColumn) return;
    const nextDir: SortDirection =
      sort === column.key ? (dir === "asc" ? "desc" : "asc") : column.defaultDir ?? "desc";
    navigate((params) => {
      params.set("sort", column.key);
      params.set("dir", nextDir);
      params.delete("page");
    });
  }

  function toggleColumn(key: string) {
    setVisibility((current) => {
      const next = mergeColumnVisibility({ ...current, [key]: !current[key] });
      try {
        window.localStorage.setItem(COLUMN_LAYOUT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Layout just will not persist to the next visit.
      }
      return next;
    });
  }

  function resetColumns() {
    setVisibility(defaultColumnVisibility());
    try {
      window.localStorage.removeItem(COLUMN_LAYOUT_STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  function toggleAllOnPage() {
    setSelected(allOnPageSelected ? new Set() : new Set(rows.map((row) => row.id)));
  }

  async function applyBulk(patch: Record<string, string>, label: string) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`${label} for ${ids.length} lead${ids.length === 1 ? "" : "s"}?`)) return;

    setBulkPending(true);
    setBulkMessage(null);
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkMessage({ tone: "error", text: data.error ?? "Bulk edit failed." });
        return;
      }
      setSelected(new Set());
      setFollowUpDate("");
      setBulkMessage(
        data.warning
          ? { tone: "error", text: data.warning }
          : {
              tone: "success",
              text: `Updated ${data.updated} lead${data.updated === 1 ? "" : "s"}.`,
            }
      );
      startNavigation(() => router.refresh());
    } catch {
      setBulkMessage({ tone: "error", text: "Bulk edit failed." });
    } finally {
      setBulkPending(false);
    }
  }

  const hasQuickFilter = Boolean(
    quickFilters.q || quickFilters.status || quickFilters.tier || quickFilters.vertical
  );
  const firstRow = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastRow = (page - 1) * perPage + rows.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setFilterParam("q", search.trim());
          }}
          className="flex items-center gap-1"
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search lead titles…"
            className="h-8 w-56 text-xs"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <Select
          className="h-8 text-xs"
          aria-label="Filter by status"
          value={quickFilters.status}
          onChange={(event) => setFilterParam("status", event.target.value)}
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {humanize(status)}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 text-xs"
          aria-label="Filter by tier"
          value={quickFilters.tier}
          onChange={(event) => setFilterParam("tier", event.target.value)}
        >
          <option value="">All tiers</option>
          {LEAD_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </Select>

        <Select
          className="h-8 text-xs"
          aria-label="Filter by vertical"
          value={quickFilters.vertical}
          onChange={(event) => setFilterParam("vertical", event.target.value)}
        >
          <option value="">All verticals</option>
          {LEAD_VERTICALS.map((vertical) => (
            <option key={vertical} value={vertical}>
              {VERTICAL_LABELS[vertical]}
            </option>
          ))}
        </Select>

        {hasQuickFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate((params) => {
                for (const key of ["q", "status", "tier", "vertical", "page"]) params.delete(key);
              })
            }
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {navigating && <span className="text-xs text-muted-foreground">Loading…</span>}

          <Select
            className="h-8 text-xs"
            aria-label="Rows per page"
            value={String(perPage)}
            onChange={(event) => setFilterParam("perPage", event.target.value)}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </Select>

          <div className="relative" ref={columnsRef}>
            <Button variant="secondary" size="sm" onClick={() => setColumnsOpen((open) => !open)}>
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
            {columnsOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-card p-2 shadow-lg">
                <div className="max-h-72 space-y-0.5 overflow-y-auto">
                  {LEAD_COLUMNS.map((column) => (
                    <label
                      key={column.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={Boolean(visibility[column.key])}
                        onChange={() => toggleColumn(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={resetColumns}
                  className="mt-1 w-full rounded px-1.5 py-1 text-left text-xs text-primary hover:bg-accent"
                >
                  Reset to defaults
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
          <span className="text-xs font-medium">{selected.size} selected on this page</span>

          <Select
            className="h-8 text-xs"
            aria-label="Set status for selected leads"
            value=""
            disabled={bulkPending}
            onChange={(event) =>
              event.target.value &&
              applyBulk({ status: event.target.value }, `Set status to "${humanize(event.target.value)}"`)
            }
          >
            <option value="">Set status…</option>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </Select>

          <Select
            className="h-8 text-xs"
            aria-label="Set tier for selected leads"
            value=""
            disabled={bulkPending}
            onChange={(event) =>
              event.target.value &&
              applyBulk({ tier: event.target.value }, `Set tier to "${event.target.value}"`)
            }
          >
            <option value="">Set tier…</option>
            {LEAD_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </Select>

          <Select
            className="h-8 text-xs"
            aria-label="Set priority for selected leads"
            value=""
            disabled={bulkPending}
            onChange={(event) =>
              event.target.value &&
              applyBulk({ priority: event.target.value }, `Set priority to "${event.target.value}"`)
            }
          >
            <option value="">Set priority…</option>
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>

          <Select
            className="h-8 text-xs"
            aria-label="Set verification for selected leads"
            value=""
            disabled={bulkPending}
            onChange={(event) =>
              event.target.value &&
              applyBulk(
                { verification_status: event.target.value },
                `Set verification to "${humanize(event.target.value)}"`
              )
            }
          >
            <option value="">Set verification…</option>
            {VERIFICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {humanize(status)}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-1">
            <Input
              type="date"
              aria-label="Follow-up date for selected leads"
              value={followUpDate}
              onChange={(event) => setFollowUpDate(event.target.value)}
              className="h-8 w-36 text-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={bulkPending || !followUpDate}
              onClick={() =>
                applyBulk({ next_follow_up_at: followUpDate }, `Set follow-up to ${followUpDate}`)
              }
            >
              Set follow-up
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkPending}
              onClick={() => applyBulk({ next_follow_up_at: "" }, "Clear the follow-up date")}
            >
              Clear follow-up
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            Deselect
          </Button>
        </div>
      )}

      {bulkMessage && (
        <p className={cn("text-xs", bulkMessage.tone === "error" ? "text-destructive" : "text-success")}>
          {bulkMessage.text}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  aria-label="Select all leads on this page"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  disabled={rows.length === 0}
                />
              </th>
              {visibleColumns.map((column) => {
                const active = sort === column.key;
                return (
                  <th key={column.key} className={cn("px-3 py-2", column.numeric && "text-right")}>
                    {column.sortColumn ? (
                      <button
                        type="button"
                        onClick={() => onSortClick(column)}
                        className={cn(
                          "inline-flex items-center gap-1 uppercase hover:text-foreground",
                          active && "text-foreground"
                        )}
                      >
                        {column.label}
                        {active ? (
                          dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((lead) => (
                <tr
                  key={lead.id}
                  className={cn(
                    "border-b border-border last:border-0 hover:bg-accent/40",
                    selected.has(lead.id) && "bg-primary/5"
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      aria-label={`Select ${lead.company?.name ?? lead.title}`}
                      checked={selected.has(lead.id)}
                      onChange={() => toggleRow(lead.id)}
                    />
                  </td>
                  {visibleColumns.map((column) => (
                    <td
                      key={column.key}
                      className={cn("px-3 py-2", column.numeric && "text-right tabular-nums")}
                    >
                      <LeadCell columnKey={column.key} lead={lead} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {total === 0
            ? "No leads"
            : `Showing ${firstRow}–${lastRow} of ${total} lead${total === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Page {page} of {lastPage}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1 || navigating}
            onClick={() => navigate((params) => params.set("page", String(page - 1)))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= lastPage || navigating}
            onClick={() => navigate((params) => params.set("page", String(page + 1)))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function LeadCell({ columnKey, lead }: { columnKey: string; lead: LeadListRow }) {
  switch (columnKey) {
    case "company":
      return (
        <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary">
          {lead.company?.name ?? "Unknown"}
        </Link>
      );
    case "contact":
      return (
        <div className="text-muted-foreground">
          {lead.primary_contact?.name ?? "—"}
          {lead.primary_contact?.job_title && (
            <div className="text-xs">{lead.primary_contact.job_title}</div>
          )}
        </div>
      );
    case "title":
      return (
        <Link href={`/leads/${lead.id}`} className="hover:text-primary">
          {lead.title}
        </Link>
      );
    case "vertical":
      return <Badge variant="outline">{humanize(lead.vertical)}</Badge>;
    case "score":
      return <>{lead.score}</>;
    case "tier":
      return <TierBadge tier={lead.tier} />;
    case "priority":
      return <span className="text-muted-foreground">{lead.priority ?? "—"}</span>;
    case "signal":
      return (
        <div
          className="max-w-xs truncate text-muted-foreground"
          title={lead.buying_signal_summary ?? undefined}
        >
          {lead.buying_signal_summary ?? "—"}
        </div>
      );
    case "service":
      return <span className="text-muted-foreground">{lead.service_type ?? "—"}</span>;
    case "country":
      return <span className="text-muted-foreground">{lead.company?.country ?? "—"}</span>;
    case "status":
      return <StatusBadge status={lead.status} />;
    case "verification":
      return <VerificationBadge status={lead.verification_status} />;
    case "followUp":
      return <span className="text-muted-foreground">{formatDate(lead.next_follow_up_at)}</span>;
    case "freshness":
      return <FreshnessBadge freshness={lead.freshness} />;
    case "created":
      return <span className="text-muted-foreground">{formatDate(lead.created_at)}</span>;
    case "updated":
      return <span className="text-muted-foreground">{formatDate(lead.updated_at)}</span>;
    default:
      return null;
  }
}
