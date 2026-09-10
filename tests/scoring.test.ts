import { describe, expect, it } from "vitest";
import type { RawSignal } from "@leads/core";
import { scoreLead, type LeadDraft, type ScoreRule } from "../workers/scoring/score";
import { vertical1HiringRules } from "../workers/scoring/rules/vertical1-hiring";
import { vertical3CardAffiliateRules } from "../workers/scoring/rules/vertical3-card-affiliate";

const DAY_MS = 24 * 60 * 60 * 1000;

function signal(overrides: Partial<RawSignal> = {}): RawSignal {
  return {
    sourceConnector: "test",
    vertical: "hiring",
    projectName: "Acme",
    signalText: "",
    discoveredAt: new Date("2026-01-01T00:00:00Z"),
    meta: {},
    raw: {},
    ...overrides,
  };
}

function draft(overrides: Partial<LeadDraft> = {}): LeadDraft {
  return {
    vertical: "hiring",
    projectName: "Acme",
    signals: [],
    hasNamedContact: false,
    ...overrides,
  };
}

/** A rule with a fixed outcome, for testing the engine rather than a vertical. */
function rule(id: string, weight: number, result: boolean | number, cap?: number): ScoreRule {
  return { id, description: `desc ${id}`, weight, cap, test: () => result };
}

describe("scoreLead — engine", () => {
  it("scores an empty rule set as zero and Low Priority", () => {
    expect(scoreLead(draft(), [])).toEqual({ score: 0, tier: "Low Priority", matchedRules: [] });
  });

  it("adds a matching rule's full weight and labels it with the description", () => {
    const result = scoreLead(draft(), [rule("a", 30, true)]);
    expect(result.score).toBe(30);
    expect(result.matchedRules).toEqual([{ id: "a", label: "desc a", points: 30 }]);
  });

  it("omits rules that do not match", () => {
    const result = scoreLead(draft(), [rule("yes", 30, true), rule("no", 40, false)]);
    expect(result.score).toBe(30);
    expect(result.matchedRules.map((r) => r.id)).toEqual(["yes"]);
  });

  it("treats a numeric result as a repeat count, multiplying the weight", () => {
    expect(scoreLead(draft(), [rule("a", 10, 4)]).score).toBe(40);
  });

  it("treats a zero count as no match, not as a zero-point match", () => {
    // scoreLead short-circuits on any falsy test result, so a rule counting
    // "extra roles beyond the first" that finds none is absent from the
    // breakdown rather than listed at 0 points.
    const result = scoreLead(draft(), [rule("a", 10, 0)]);
    expect(result.score).toBe(0);
    expect(result.matchedRules).toEqual([]);
  });

  it("caps a repeat-counted rule at its cap", () => {
    expect(scoreLead(draft(), [rule("a", 10, 9, 30)]).score).toBe(30);
  });

  it("does not let a cap raise a contribution that is already below it", () => {
    expect(scoreLead(draft(), [rule("a", 10, 1, 30)]).score).toBe(10);
  });

  it("clamps the total to 100 even when the weights sum past it", () => {
    const result = scoreLead(draft(), [rule("a", 60, true), rule("b", 60, true)]);
    expect(result.score).toBe(100);
    // The breakdown still shows each pre-clamp contribution, so the reason a
    // lead maxed out stays visible.
    expect(result.matchedRules.map((r) => r.points)).toEqual([60, 60]);
  });

  it("never returns a negative score", () => {
    expect(scoreLead(draft(), [rule("penalty", -40, true)]).score).toBe(0);
  });

  it("rounds the total from unrounded points, not from the rounded breakdown", () => {
    // Two rules at 2.5 points each total 5. Each is displayed as 3, so summing
    // the breakdown would read 6 — the score is computed before rounding on
    // purpose.
    const result = scoreLead(draft(), [rule("a", 5, 0.5), rule("b", 5, 0.5)]);
    expect(result.matchedRules.map((r) => r.points)).toEqual([3, 3]);
    expect(result.score).toBe(5);
  });

  it.each([
    [100, "A+"],
    [85, "A+"],
    [84, "A"],
    [70, "A"],
    [69, "B"],
    [50, "B"],
    [49, "C"],
    [25, "C"],
    [24, "Low Priority"],
    [0, "Low Priority"],
  ])("puts a score of %i in tier %s", (score, tier) => {
    expect(scoreLead(draft(), [rule("a", score, true)]).tier).toBe(tier);
  });
});

describe("vertical1HiringRules", () => {
  it("scores a lead with no signals and no contact as zero", () => {
    expect(scoreLead(draft(), vertical1HiringRules)).toEqual({
      score: 0,
      tier: "Low Priority",
      matchedRules: [],
    });
  });

  it("caps a large role cluster at 30 points rather than 90", () => {
    const result = scoreLead(
      draft({ signals: [signal({ meta: { openRolesAtCompany: 10 } })] }),
      vertical1HiringRules
    );
    expect(result.matchedRules).toEqual([
      { id: "multi-role-cluster", label: expect.any(String), points: 30 },
    ]);
    expect(result.score).toBe(30);
  });

  it("gives no cluster credit for a single open role", () => {
    const result = scoreLead(
      draft({ signals: [signal({ meta: { openRolesAtCompany: 1 } })] }),
      vertical1HiringRules
    );
    expect(result.score).toBe(0);
  });

  it("gives full recency credit inside 14 days", () => {
    const result = scoreLead(
      draft({ signals: [signal({ meta: { postedAt: new Date(Date.now() - 3 * DAY_MS) } })] }),
      vertical1HiringRules
    );
    expect(result.matchedRules).toEqual([
      { id: "posted-recently", label: expect.any(String), points: 10 },
    ]);
  });

  it("decays recency credit linearly between day 14 and day 60", () => {
    // Day 37 is the midpoint of the 14-to-60 decay window, so half of 10.
    const result = scoreLead(
      draft({ signals: [signal({ meta: { postedAt: new Date(Date.now() - 37 * DAY_MS) } })] }),
      vertical1HiringRules
    );
    expect(result.score).toBe(5);
  });

  it("gives no recency credit at 60 days or older", () => {
    const result = scoreLead(
      draft({ signals: [signal({ meta: { postedAt: new Date(Date.now() - 61 * DAY_MS) } })] }),
      vertical1HiringRules
    );
    expect(result.score).toBe(0);
  });

  it("ignores a postedAt that is a string rather than a Date", () => {
    const result = scoreLead(
      draft({ signals: [signal({ meta: { postedAt: new Date().toISOString() } })] }),
      vertical1HiringRules
    );
    expect(result.score).toBe(0);
  });

  it.each(["We need someone immediate", "Hiring ASAP", "This is urgent", "Needed urgently"])(
    "reads %j as urgency language",
    (signalText) => {
      const result = scoreLead(draft({ signals: [signal({ signalText })] }), vertical1HiringRules);
      expect(result.matchedRules.map((r) => r.id)).toContain("urgency-language");
    }
  );

  it("misses the inflected form immediately — a known gap in the pattern", () => {
    // Asserted so the behaviour is visible rather than surprising: the
    // pattern's word boundary covers urgent/urgently but not immediately,
    // which reads as urgency language to a human.
    const result = scoreLead(
      draft({ signals: [signal({ signalText: "We need someone immediately" })] }),
      vertical1HiringRules
    );
    expect(result.matchedRules.map((r) => r.id)).not.toContain("urgency-language");
  });

  it("credits a named contact from the draft flag, not from the signals", () => {
    const result = scoreLead(draft({ hasNamedContact: true }), vertical1HiringRules);
    expect(result.matchedRules).toEqual([
      { id: "named-contact-found", label: expect.any(String), points: 10 },
    ]);
  });

  it("clamps a lead that matches every rule to 100 and A+", () => {
    const result = scoreLead(
      draft({
        hasNamedContact: true,
        signals: [
          signal({
            signalText: "Urgent: hiring a community lead",
            meta: {
              rateDisclosed: true,
              hourlyRate: 75,
              openRolesAtCompany: 10,
              employmentType: "full_time",
              fundingSignal: true,
              postedAt: new Date(Date.now() - DAY_MS),
              accountsManaged: 5,
            },
          }),
        ],
      }),
      vertical1HiringRules
    );
    expect(result.score).toBe(100);
    expect(result.tier).toBe("A+");
    // Raw contributions total 120; the clamp is what brings it to 100.
    expect(result.matchedRules.reduce((sum, r) => sum + r.points, 0)).toBe(120);
  });

  it("reads meta across every signal rather than only the first", () => {
    const result = scoreLead(
      draft({ signals: [signal({ meta: {} }), signal({ meta: { fundingSignal: true } })] }),
      vertical1HiringRules
    );
    expect(result.matchedRules.map((r) => r.id)).toEqual(["funding-signal"]);
  });
});

describe("vertical3CardAffiliateRules", () => {
  it("credits an X presence from the source connector name", () => {
    const result = scoreLead(
      draft({
        vertical: "card_affiliate",
        signals: [signal({ vertical: "card_affiliate", sourceConnector: "twitter-agency-signals" })],
      }),
      vertical3CardAffiliateRules
    );
    expect(result.matchedRules.map((r) => r.id)).toEqual(["active-x-presence"]);
  });

  it("requires two or more channels for multi-channel credit", () => {
    const idsForChannelCount = (channelsCount: number) =>
      scoreLead(
        draft({ vertical: "card_affiliate", signals: [signal({ meta: { channelsCount } })] }),
        vertical3CardAffiliateRules
      ).matchedRules.map((r) => r.id);

    expect(idsForChannelCount(1)).not.toContain("multi-channel");
    expect(idsForChannelCount(2)).toContain("multi-channel");
  });

  it("scores a fully-qualified agency as A+", () => {
    const result = scoreLead(
      draft({
        vertical: "card_affiliate",
        hasNamedContact: true,
        signals: [
          signal({
            sourceConnector: "twitter-agency-signals",
            meta: {
              adSpendMentioned: true,
              adSpendUsd: 2_000_000,
              channelsCount: 3,
              hasCryptoClientHistory: true,
              teamSizeEstimate: 25,
            },
          }),
        ],
      }),
      vertical3CardAffiliateRules
    );
    expect(result.score).toBe(95);
    expect(result.tier).toBe("A+");
  });
});
