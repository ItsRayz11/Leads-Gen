import { describe, expect, it } from "vitest";
import {
  decideNotifications,
  notificationDedupeKey,
  type LeadForNotifications,
} from "../workers/pipeline/decide-notifications";

const NOW = new Date("2026-06-15T12:00:00Z");

function lead(overrides: Partial<LeadForNotifications> = {}): LeadForNotifications {
  return {
    id: "lead-1",
    companyName: "Acme",
    status: "new",
    verificationStatus: null,
    tier: null,
    nextFollowUpAt: null,
    ...overrides,
  };
}

describe("decideNotifications — follow-ups", () => {
  it("drafts follow_up_overdue for a past due date", () => {
    const drafts = decideNotifications([lead({ nextFollowUpAt: "2026-06-10T00:00:00Z" })], new Set(), NOW);
    expect(drafts).toEqual([
      { type: "follow_up_overdue", title: "Follow-up overdue: Acme", body: null, relatedLeadId: "lead-1" },
    ]);
  });

  it("drafts follow_up_due for a date matching today", () => {
    // Same instant as NOW, so it's "today" in whatever local timezone the
    // test runs in — a fixture near midnight UTC would roll to a different
    // local calendar day depending on the machine's offset.
    const drafts = decideNotifications([lead({ nextFollowUpAt: NOW.toISOString() })], new Set(), NOW);
    expect(drafts).toEqual([
      { type: "follow_up_due", title: "Follow-up due today: Acme", body: null, relatedLeadId: "lead-1" },
    ]);
  });

  it("drafts nothing for a future follow-up date", () => {
    // Two full days out, so it reads as "future" regardless of the test
    // runner's local timezone offset from NOW.
    expect(decideNotifications([lead({ nextFollowUpAt: "2026-06-17T12:00:00Z" })], new Set(), NOW)).toEqual([]);
  });

  it("drafts nothing when there's no follow-up date set", () => {
    expect(decideNotifications([lead({ nextFollowUpAt: null })], new Set(), NOW)).toEqual([]);
  });
});

describe("decideNotifications — verification and high-intent", () => {
  it("drafts needs_verification for a lead flagged as such", () => {
    const drafts = decideNotifications([lead({ verificationStatus: "needs_verification" })], new Set(), NOW);
    expect(drafts).toEqual([
      { type: "needs_verification", title: "Needs verification: Acme", body: null, relatedLeadId: "lead-1" },
    ]);
  });

  it.each(["unverified", "partially_verified", "verified"] as const)(
    "does not draft needs_verification for status %j",
    (status) => {
      expect(decideNotifications([lead({ verificationStatus: status })], new Set(), NOW)).toEqual([]);
    }
  );

  it.each(["A+", "A"] as const)("drafts high_intent_lead for tier %j", (tier) => {
    const drafts = decideNotifications([lead({ tier })], new Set(), NOW);
    expect(drafts).toEqual([
      { type: "high_intent_lead", title: "High-intent lead: Acme", body: null, relatedLeadId: "lead-1" },
    ]);
  });

  it.each(["B", "C", "Low Priority"] as const)("does not draft high_intent_lead for tier %j", (tier) => {
    expect(decideNotifications([lead({ tier })], new Set(), NOW)).toEqual([]);
  });

  it("drafts multiple notifications for one lead that qualifies on every dimension", () => {
    const drafts = decideNotifications(
      [lead({ nextFollowUpAt: "2026-06-01T00:00:00Z", verificationStatus: "needs_verification", tier: "A+" })],
      new Set(),
      NOW
    );
    expect(drafts.map((d) => d.type).sort()).toEqual(
      ["follow_up_overdue", "high_intent_lead", "needs_verification"].sort()
    );
  });
});

describe("decideNotifications — closed leads and existing unread", () => {
  it.each(["won", "no_response", "rejected", "not_interested", "not_a_fit", "lost"] as const)(
    "drafts nothing for a closed lead in status %j, even if every trigger would otherwise fire",
    (status) => {
      const drafts = decideNotifications(
        [
          lead({
            status,
            nextFollowUpAt: "2026-06-01T00:00:00Z",
            verificationStatus: "needs_verification",
            tier: "A+",
          }),
        ],
        new Set(),
        NOW
      );
      expect(drafts).toEqual([]);
    }
  );

  it("does not re-draft a notification whose (type, lead) pair is already unread", () => {
    const existing = new Set([notificationDedupeKey("needs_verification", "lead-1")]);
    const drafts = decideNotifications([lead({ verificationStatus: "needs_verification" })], existing, NOW);
    expect(drafts).toEqual([]);
  });

  it("still drafts the other dimensions when only one type is already unread", () => {
    const existing = new Set([notificationDedupeKey("needs_verification", "lead-1")]);
    const drafts = decideNotifications(
      [lead({ verificationStatus: "needs_verification", tier: "A" })],
      existing,
      NOW
    );
    expect(drafts).toEqual([
      { type: "high_intent_lead", title: "High-intent lead: Acme", body: null, relatedLeadId: "lead-1" },
    ]);
  });

  it("scopes the existing-unread check per lead, not globally", () => {
    const existing = new Set([notificationDedupeKey("needs_verification", "lead-1")]);
    const drafts = decideNotifications(
      [lead({ id: "lead-2", companyName: "Globex", verificationStatus: "needs_verification" })],
      existing,
      NOW
    );
    expect(drafts).toEqual([
      { type: "needs_verification", title: "Needs verification: Globex", body: null, relatedLeadId: "lead-2" },
    ]);
  });
});
