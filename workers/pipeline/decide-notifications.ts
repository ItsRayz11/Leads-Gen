import type { LeadStatus, LeadTier, VerificationStatus } from "@leads/db/types.js";

export type NotificationType = "follow_up_due" | "follow_up_overdue" | "needs_verification" | "high_intent_lead";

export interface LeadForNotifications {
  id: string;
  companyName: string;
  status: LeadStatus;
  verificationStatus: VerificationStatus | null;
  tier: LeadTier | null;
  nextFollowUpAt: string | null;
}

export interface NotificationDraft {
  type: NotificationType;
  title: string;
  body: string | null;
  relatedLeadId: string;
}

/** A lead in one of these statuses is done being worked — no more reminders about it. */
const CLOSED_STATUSES = new Set<LeadStatus>(["won", "no_response", "rejected", "not_interested", "not_a_fit", "lost"]);

const HIGH_INTENT_TIERS = new Set<LeadTier>(["A+", "A"]);

export function notificationDedupeKey(type: NotificationType, leadId: string): string {
  return `${type}:${leadId}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Pure decision logic for which notifications should exist right now, kept
 * separate from the Supabase reads/writes in generate-notifications.ts so it
 * can be unit tested without a database. `existingUnreadKeys` prevents
 * re-drafting a notification that's already sitting unread for the same
 * (type, lead) pair — the DB has a matching unique index as a second guard.
 */
export function decideNotifications(
  leads: LeadForNotifications[],
  existingUnreadKeys: ReadonlySet<string>,
  now: Date
): NotificationDraft[] {
  const today = startOfDay(now);
  const drafts: NotificationDraft[] = [];

  function add(type: NotificationType, title: string, leadId: string) {
    if (existingUnreadKeys.has(notificationDedupeKey(type, leadId))) return;
    drafts.push({ type, title, body: null, relatedLeadId: leadId });
  }

  for (const lead of leads) {
    if (CLOSED_STATUSES.has(lead.status)) continue;

    if (lead.nextFollowUpAt) {
      const dueDay = startOfDay(new Date(lead.nextFollowUpAt));
      if (dueDay < today) {
        add("follow_up_overdue", `Follow-up overdue: ${lead.companyName}`, lead.id);
      } else if (dueDay.getTime() === today.getTime()) {
        add("follow_up_due", `Follow-up due today: ${lead.companyName}`, lead.id);
      }
    }

    if (lead.verificationStatus === "needs_verification") {
      add("needs_verification", `Needs verification: ${lead.companyName}`, lead.id);
    }

    if (lead.tier && HIGH_INTENT_TIERS.has(lead.tier)) {
      add("high_intent_lead", `High-intent lead: ${lead.companyName}`, lead.id);
    }
  }

  return drafts;
}
