export interface TransitionColumn<T extends { id: string; status: string }> {
  status: string;
  leads: T[];
}

/**
 * Moves a lead from its current pipeline column to `toStatus`, used by both
 * the Kanban drag-and-drop and the status dropdown to compute the optimistic
 * board state before the server confirms it. Pure and side-effect free so it
 * can be unit tested without a DOM or a network call.
 *
 * No-ops (returns `columns` unchanged) when the lead isn't found, is already
 * in `toStatus`, or `toStatus` isn't one of the given columns — the caller
 * only ever passes a real pipeline status, but a stale drag target shouldn't
 * silently drop a card into the void.
 */
export function moveLeadBetweenColumns<T extends { id: string; status: string }>(
  columns: TransitionColumn<T>[],
  leadId: string,
  toStatus: string
): TransitionColumn<T>[] {
  const current = columns.flatMap((c) => c.leads).find((l) => l.id === leadId);
  if (!current || current.status === toStatus) return columns;
  if (!columns.some((c) => c.status === toStatus)) return columns;

  return columns.map((col) => {
    if (col.status === current.status) return { ...col, leads: col.leads.filter((l) => l.id !== leadId) };
    if (col.status === toStatus) return { ...col, leads: [{ ...current, status: toStatus }, ...col.leads] };
    return col;
  });
}
