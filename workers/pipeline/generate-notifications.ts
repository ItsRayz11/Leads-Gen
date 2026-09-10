import { createServiceRoleClient } from "@leads/db";
import type { LeadStatus, LeadTier, VerificationStatus } from "@leads/db/types.js";
import { decideNotifications, notificationDedupeKey, type LeadForNotifications } from "./decide-notifications.js";
import { isRunAsScript } from "./shared.js";

/**
 * Scans every open lead for reminder-worthy state (a follow-up due or
 * overdue, a contact still needing verification, or a lead that just scored
 * into the top tiers) and inserts a `notifications` row for anything not
 * already sitting unread. Idempotent to re-run: `decideNotifications` skips
 * anything matching an existing unread (type, lead) pair, and the DB's
 * partial unique index (`notifications_unread_dedupe_idx`) is a second
 * guard against the same duplicate ever landing twice.
 */
export async function generateNotifications(): Promise<{ created: number }> {
  const supabase = createServiceRoleClient();

  const { data: leadsRaw, error: leadsError } = await supabase
    .from("leads")
    .select("id, status, verification_status, tier, next_follow_up_at, company:companies ( name )");
  if (leadsError) throw leadsError;

  const leads: LeadForNotifications[] = (leadsRaw ?? []).map((l) => ({
    id: l.id,
    companyName: (l.company as { name: string } | null)?.name ?? "Unknown company",
    status: l.status as LeadStatus,
    verificationStatus: l.verification_status as VerificationStatus | null,
    tier: l.tier as LeadTier | null,
    nextFollowUpAt: l.next_follow_up_at,
  }));

  const { data: existingUnread, error: unreadError } = await supabase
    .from("notifications")
    .select("type, related_lead_id")
    .eq("read", false);
  if (unreadError) throw unreadError;

  const existingKeys = new Set(
    (existingUnread ?? [])
      .filter((n): n is { type: string; related_lead_id: string } => n.related_lead_id !== null)
      .map((n) => notificationDedupeKey(n.type as Parameters<typeof notificationDedupeKey>[0], n.related_lead_id))
  );

  const drafts = decideNotifications(leads, existingKeys, new Date());

  if (drafts.length > 0) {
    const { error: insertError } = await supabase.from("notifications").insert(
      drafts.map((d) => ({
        type: d.type,
        title: d.title,
        body: d.body,
        related_lead_id: d.relatedLeadId,
      }))
    );
    if (insertError) throw insertError;
  }

  console.log(`Created ${drafts.length} notification(s).`);
  return { created: drafts.length };
}

if (isRunAsScript(import.meta.url)) {
  generateNotifications().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
