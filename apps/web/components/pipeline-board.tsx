"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type DragEvent } from "react";
import { TierBadge } from "./ui/badge";
import { StatusSelect } from "./lead/status-select";
import { formatDate } from "../lib/utils";
import { moveLeadBetweenColumns } from "../lib/pipeline-transitions";
import type { HiddenStatusCount, PipelineColumn, PipelineStatus } from "../lib/data/pipeline";

const COLUMN_TITLES: Record<string, string> = {
  new: "New",
  researching: "Researching",
  qualified: "Qualified",
  contacted: "Contacted",
  follow_up: "Follow Up",
  replied: "Replied",
  meeting: "Meeting",
  negotiation: "Negotiation",
  won: "Won",
};

const HIDDEN_STATUS_LABELS: Record<string, string> = {
  no_response: "no response",
  rejected: "rejected",
  not_interested: "not interested",
  not_a_fit: "not a fit",
  lost: "lost",
  on_hold: "on hold",
  archived: "archived",
};

export function PipelineBoard({
  columns: initialColumns,
  hidden = [],
}: {
  columns: PipelineColumn[];
  hidden?: HiddenStatusCount[];
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PipelineStatus | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Server truth wins once a refresh completes, replacing the optimistic move.
  useEffect(() => setColumns(initialColumns), [initialColumns]);

  async function moveLead(leadId: string, toStatus: PipelineStatus) {
    const before = columns;
    const after = moveLeadBetweenColumns(columns, leadId, toStatus) as PipelineColumn[];
    if (after === before) return;

    setColumns(after);

    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: toStatus }),
    });
    startTransition(() => router.refresh());
  }

  function onDrop(event: DragEvent<HTMLDivElement>, status: PipelineStatus) {
    event.preventDefault();
    setDragOverStatus(null);
    const leadId = event.dataTransfer.getData("text/plain") || dragLeadId;
    if (leadId) moveLead(leadId, status);
    setDragLeadId(null);
  }

  const hiddenTotal = hidden.reduce((sum, h) => sum + h.count, 0);

  return (
    <div className="space-y-2">
      {hiddenTotal > 0 && (
        <p className="text-xs text-muted-foreground">
          {hiddenTotal} lead{hiddenTotal === 1 ? "" : "s"} not shown here (
          {hidden
            .map((h) => `${h.count} ${HIDDEN_STATUS_LABELS[h.status] ?? h.status}`)
            .join(", ")}
          ) — these won&apos;t reopen automatically.{" "}
          <Link href="/leads" className="text-primary hover:underline">
            View in All Leads
          </Link>
          .
        </p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
        <div
          key={column.status}
          className="w-64 shrink-0"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverStatus(column.status);
          }}
          onDragLeave={() => setDragOverStatus((s) => (s === column.status ? null : s))}
          onDrop={(e) => onDrop(e, column.status)}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-medium">{COLUMN_TITLES[column.status] ?? column.status}</h2>
            <span className="text-xs text-muted-foreground">{column.leads.length}</span>
          </div>
          <div
            className={`max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto rounded-lg border p-2 transition-colors ${
              dragOverStatus === column.status ? "border-primary bg-primary/5" : "border-border bg-muted/20"
            }`}
          >
            {column.leads.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">No leads</p>
            ) : (
              column.leads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => {
                    setDragLeadId(lead.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", lead.id);
                  }}
                  onDragEnd={() => {
                    setDragLeadId(null);
                    setDragOverStatus(null);
                  }}
                  className={`cursor-grab rounded-md border border-border bg-card p-2 text-sm active:cursor-grabbing ${
                    dragLeadId === lead.id ? "opacity-50" : ""
                  }`}
                >
                  <Link href={`/leads/${lead.id}`} className="font-medium hover:text-primary">
                    {lead.company?.name ?? "Unknown"}
                  </Link>
                  <div className="mt-1 flex items-center justify-between">
                    <TierBadge tier={lead.tier} />
                    <span className="text-xs text-muted-foreground">{lead.score}</span>
                  </div>
                  {lead.next_follow_up_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Follow up {formatDate(lead.next_follow_up_at)}
                    </p>
                  )}
                  <div className="mt-2">
                    <StatusSelect key={lead.status} leadId={lead.id} status={lead.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
