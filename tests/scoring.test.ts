import { describe, expect, it } from "vitest";
import type { RawSignal } from "@leads/core";
import {
  DIMENSION_LABELS,
  SCORE_DIMENSIONS,
  VERTICAL_DIMENSION_WEIGHTS,
  scoreLead,
  type LeadDraft,
  type ScoreDimension,
  type ScoreRule,
} from "../workers/scoring/score";
import { vertical1HiringRules } from "../workers/scoring/rules/vertical1-hiring";
import { vertical2GeneralRules } from "../workers/scoring/rules/vertical2-general";
import { vertical3CardAffiliateRules } from "../workers/scoring/rules/vertical3-card-affiliate";

const DAY_MS = 24 * 60 * 60 * 1000;

function signal(overrides: Partial<RawSignal> = {}): RawSignal {
  return {
    sourceConnector: "greenhouse",
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
function rule(
  id: string,
  dimension: ScoreDimension,
  weight: number,
  result: boolean | number,
  cap?: number
): ScoreRule {
  return { id, description: `desc ${id}`, dimension, weight, cap, test: () => result };
}

/** Everything a maximal hiring lead needs, so tests can subtract one thing at a time. */
function maximalHiringDraft(overrides: Partial<LeadDraft> = {}): LeadDraft {
  return draft({
    hasNamedContact: true,
    signals: [
      signal({
        signalText: "Urgent: hiring a community lead immediately",
        evidenceUrl: "https://acme.com/jobs/1",
        meta: {
          rateDisclosed: true,
          hourlyRate: 75,
          openRolesAtCompany: 10,
          employmentType: "full_time",
          fundingSignal: true,
          postedAt: new Date(),
          accountsManaged: 5,
        },
      }),
      // Two further connectors, so corroboration reaches its cap and every
      // dimension is genuinely at 100.
      signal({ sourceConnector: "lever" }),
      signal({ sourceConnector: "ashby" }),
    ],
    ...overrides,
  });
}

describe("dimension configuration", () => {
  it.each(Object.keys(VERTICAL_DIMENSION_WEIGHTS))(
    "weights %s so the overall score is a plain percentage",
    (vertical) => {
      const weights = VERTICAL_DIMENSION_WEIGHTS[vertical as "hiring"];
      const sum = Object.values(weights).reduce((total, weight) => total + (weight ?? 0), 0);
      expect(sum).toBe(100);
    }
  );

  it("labels every dimension", () => {
    for (const dimension of SCORE_DIMENSIONS) {
      expect(DIMENSION_LABELS[dimension]).toBeTruthy();
    }
  });

  it.each([
    ["hiring", vertical1HiringRules],
    ["general", vertical2GeneralRules],
    ["card_affiliate", vertical3CardAffiliateRules],
  ] as const)("weights every dimension %s actually scores", (vertical, rules) => {
    const weights = VERTICAL_DIMENSION_WEIGHTS[vertical];
    for (const dimension of new Set(rules.map((r) => r.dimension))) {
      // A dimension with rules but no weight would be computed and then
      // dropped from the blend, which is silent dead weight.
      expect(weights[dimension], `${vertical} weights ${dimension}`).toBeGreaterThan(0);
    }
  });

  it.each([
    ["hiring", vertical1HiringRules],
    ["general", vertical2GeneralRules],
    ["card_affiliate", vertical3CardAffiliateRules],
  ] as const)("caps every countable rule in %s", (_vertical, rules) => {
    // An uncapped countable rule has no maximum, so its dimension would have
    // no denominator to normalize against.
    for (const r of rules) {
      if (typeof r.test(draft({ signals: [signal(), signal(), signal()] })) === "number") {
        expect(r.cap, `${r.id} returns a count and needs a cap`).toBeDefined();
      }
    }
  });
});

describe("scoreLead — engine", () => {
  it("reports every dimension as unmeasured when there are no rules", () => {
    const result = scoreLead(draft(), []);
    expect(result.score).toBe(0);
    expect(result.tier).toBe("Low Priority");
    expect(result.matchedRules).toEqual([]);
    expect(result.tierLimitedBy).toBeNull();
    for (const dimension of SCORE_DIMENSIONS) {
      expect(result.dimensions[dimension]).toBeNull();
    }
  });

  it("scores a dimension as the share of its available points that were earned", () => {
    const result = scoreLead(draft(), [
      rule("hit", "intent", 30, true),
      rule("miss", "intent", 10, false),
    ]);
    // 30 of 40 available in the dimension.
    expect(result.dimensions.intent).toBe(75);
  });

  it("gives a fully-earned dimension 100 regardless of its raw point total", () => {
    // The point of normalizing: a 35-point dimension and a 55-point one both
    // read 100 when fully earned, so they stay comparable.
    expect(scoreLead(draft(), [rule("a", "intent", 35, true)]).dimensions.intent).toBe(100);
    expect(scoreLead(draft(), [rule("a", "intent", 55, true)]).dimensions.intent).toBe(100);
  });

  it("leaves a dimension with no rules null rather than zero", () => {
    // "not measured" and "measured as zero" are different facts, and only one
    // of them should drag the overall score down.
    const result = scoreLead(draft(), [rule("a", "intent", 30, true)]);
    expect(result.dimensions.intent).toBe(100);
    expect(result.dimensions.fit).toBeNull();
    expect(result.dimensions.companyQuality).toBeNull();
  });

  it("scores a dimension zero when it has rules and none matched", () => {
    expect(scoreLead(draft(), [rule("a", "intent", 30, false)]).dimensions.intent).toBe(0);
  });

  it("keeps dimensions independent", () => {
    const result = scoreLead(draft(), [
      rule("earned", "intent", 30, true),
      rule("unearned", "fit", 30, false),
    ]);
    expect(result.dimensions.intent).toBe(100);
    expect(result.dimensions.fit).toBe(0);
  });

  it("normalizes a countable rule against its cap, not its weight", () => {
    // 9 x 10 points capped at 30, against 30 available.
    expect(scoreLead(draft(), [rule("a", "companyQuality", 10, 9, 30)]).dimensions.companyQuality).toBe(100);
    // 1 x 10 points against the same 30 available.
    expect(scoreLead(draft(), [rule("a", "companyQuality", 10, 1, 30)]).dimensions.companyQuality).toBe(33);
  });

  it("treats a zero count as no match", () => {
    const result = scoreLead(draft(), [rule("a", "intent", 10, 0, 30)]);
    expect(result.matchedRules).toEqual([]);
    expect(result.dimensions.intent).toBe(0);
  });

  it("blends the dimensions by the vertical's weights", () => {
    // hiring weights intent 30 and freshness 15, so intent at 100 with
    // freshness at 0 lands at 30/(30+15) of the way up.
    const result = scoreLead(draft(), [
      rule("a", "intent", 30, true),
      rule("b", "freshness", 10, false),
    ]);
    expect(result.dimensions).toMatchObject({ intent: 100, freshness: 0 });
    expect(result.score).toBe(67);
    expect(result.tier).toBe("B");
  });

  it("excludes unmeasured dimensions from the blend", () => {
    // Only intent has rules, so a fully-earned intent is a 100 overall even
    // though five dimensions went unscored.
    expect(scoreLead(draft(), [rule("a", "intent", 30, true)]).score).toBe(100);
  });

  it("keeps the breakdown in the shape lead_scores already stores, plus the dimension", () => {
    const result = scoreLead(draft(), [rule("a", "intent", 30, true)]);
    expect(result.matchedRules).toEqual([
      { id: "a", label: "desc a", points: 30, dimension: "intent" },
    ]);
  });

  it("reports pre-normalization points in the breakdown", () => {
    // The list is there to explain the score, so it shows what each rule was
    // worth rather than a re-scaled number.
    const result = scoreLead(draft(), [rule("a", "companyQuality", 10, 9, 30)]);
    expect(result.matchedRules[0].points).toBe(30);
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
  ])("puts an overall of %i in tier %s", (target, tier) => {
    // One weighted dimension, so the dimension score is the overall score.
    const result = scoreLead(draft(), [
      rule("hit", "intent", target, target > 0),
      rule("rest", "intent", 100 - target, false),
    ]);
    expect(result.score).toBe(target);
    expect(result.tier).toBe(tier);
  });
});

describe("scoreLead — tier gates", () => {
  it("holds a lead with no named contact at B, however good the rest is", () => {
    // Every other dimension maxed puts this at exactly 85 — an A+ on score
    // alone — but there is nobody to contact, so it cannot be worked today.
    const result = scoreLead(maximalHiringDraft({ hasNamedContact: false }), vertical1HiringRules);
    expect(result.score).toBe(85);
    expect(result.dimensions.contactability).toBe(0);
    expect(result.tier).toBe("B");
    expect(result.tierLimitedBy).toBe("no named contact found yet");
  });

  it("lets the same lead reach A+ once a contact is found", () => {
    // This is what contact enrichment re-scoring buys: the gate lifts.
    const result = scoreLead(maximalHiringDraft(), vertical1HiringRules);
    expect(result.score).toBe(100);
    expect(result.tier).toBe("A+");
    expect(result.tierLimitedBy).toBeNull();
  });

  it("holds a lead with no buying signal at C", () => {
    const result = scoreLead(draft(), [
      rule("intent", "intent", 30, false),
      rule("quality", "companyQuality", 30, true),
      rule("contact", "contactability", 10, true),
      rule("fresh", "freshness", 10, true),
      rule("evidence", "evidence", 10, true),
      rule("fit", "fit", 10, true),
    ]);
    expect(result.dimensions.intent).toBe(0);
    expect(result.score).toBe(70);
    expect(result.tier).toBe("C");
    expect(result.tierLimitedBy).toBe("no active buying signal");
  });

  it("reports the tightest gate when more than one applies", () => {
    const result = scoreLead(draft(), [
      rule("intent", "intent", 30, false),
      rule("contact", "contactability", 10, false),
      rule("quality", "companyQuality", 30, true),
      rule("fresh", "freshness", 10, true),
      rule("evidence", "evidence", 10, true),
      rule("fit", "fit", 10, true),
    ]);
    // Both gates bite; C is the binding one.
    expect(result.tier).toBe("C");
    expect(result.tierLimitedBy).toBe("no active buying signal");
  });

  it("does not gate on a dimension the vertical never measures", () => {
    // card_affiliate has no freshness rules, so freshness is unknown rather
    // than absent and must not hold the tier down.
    const result = scoreLead(
      draft({
        vertical: "card_affiliate",
        hasNamedContact: true,
        signals: [
          signal({
            vertical: "card_affiliate",
            sourceConnector: "twitter-agency-signals",
            evidenceUrl: "https://agency.com/about",
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
    expect(result.dimensions.freshness).toBeNull();
    expect(result.tier).toBe("A+");
    expect(result.tierLimitedBy).toBeNull();
  });

  it("does not claim a gate when the score was already that low", () => {
    const result = scoreLead(draft(), [rule("intent", "intent", 30, false)]);
    expect(result.tier).toBe("Low Priority");
    expect(result.tierLimitedBy).toBeNull();
  });
});

describe("vertical1HiringRules", () => {
  it("scores an empty draft as zero across every measured dimension", () => {
    const result = scoreLead(draft(), vertical1HiringRules);
    expect(result.score).toBe(0);
    expect(result.tier).toBe("Low Priority");
    expect(result.dimensions).toEqual({
      intent: 0,
      fit: 0,
      evidence: 0,
      freshness: 0,
      contactability: 0,
      companyQuality: 0,
    });
  });

  it("puts a disclosed rate and urgent wording in intent, not company quality", () => {
    const result = scoreLead(
      draft({
        signals: [
          signal({
            signalText: "Urgent hire",
            meta: { rateDisclosed: true, hourlyRate: 90 },
          }),
        ],
      }),
      vertical1HiringRules
    );
    expect(result.dimensions.intent).toBe(100);
    expect(result.dimensions.companyQuality).toBe(0);
  });

  it("puts open roles and funding in company quality, not intent", () => {
    const result = scoreLead(
      draft({ signals: [signal({ meta: { openRolesAtCompany: 10, fundingSignal: true } })] }),
      vertical1HiringRules
    );
    expect(result.dimensions.intent).toBe(0);
    // 30 (capped cluster) + 15 (funding) of 55 available.
    expect(result.dimensions.companyQuality).toBe(82);
  });

  it("caps a large role cluster so one company cannot max company quality alone", () => {
    const result = scoreLead(
      draft({ signals: [signal({ meta: { openRolesAtCompany: 40 } })] }),
      vertical1HiringRules
    );
    expect(result.matchedRules.find((r) => r.id === "multi-role-cluster")?.points).toBe(30);
    expect(result.dimensions.companyQuality).toBe(55);
  });

  it("gives no cluster credit for a single open role", () => {
    const result = scoreLead(
      draft({ signals: [signal({ meta: { openRolesAtCompany: 1 } })] }),
      vertical1HiringRules
    );
    expect(result.dimensions.companyQuality).toBe(0);
  });

  it.each([
    "We need someone immediate",
    "We need someone immediately",
    "Hiring ASAP",
    "This is urgent",
    "Needed urgently",
  ])("reads %j as urgency language", (signalText) => {
    // "immediately" is the commoner phrasing and the earlier pattern missed
    // it, scoring an urgent post as having no urgency at all.
    const result = scoreLead(draft({ signals: [signal({ signalText })] }), vertical1HiringRules);
    expect(result.matchedRules.map((r) => r.id)).toContain("urgency-language");
  });

  it("does not read an unrelated word as urgency language", () => {
    const result = scoreLead(
      draft({ signals: [signal({ signalText: "Immediacy is not required" })] }),
      vertical1HiringRules
    );
    expect(result.matchedRules.map((r) => r.id)).not.toContain("urgency-language");
  });

  describe("freshness", () => {
    const withPostedAt = (postedAt: unknown) =>
      scoreLead(draft({ signals: [signal({ meta: { postedAt } })] }), vertical1HiringRules);

    it("gives full credit inside 14 days", () => {
      expect(withPostedAt(new Date(Date.now() - 3 * DAY_MS)).dimensions.freshness).toBe(100);
    });

    it("decays linearly between day 14 and day 60", () => {
      // Day 37 is the midpoint of the decay window.
      expect(withPostedAt(new Date(Date.now() - 37 * DAY_MS)).dimensions.freshness).toBe(50);
    });

    it("gives no credit at 60 days or older", () => {
      expect(withPostedAt(new Date(Date.now() - 61 * DAY_MS)).dimensions.freshness).toBe(0);
    });

    it("accepts an ISO string, which is how a re-scored signal arrives", () => {
      // Regression: the rule tested `instanceof Date`, but a draft rebuilt
      // from the database has been through JSON, so every re-scored lead read
      // as undated — and re-scoring is how every score in the app is written.
      expect(withPostedAt(new Date(Date.now() - 3 * DAY_MS).toISOString()).dimensions.freshness).toBe(100);
    });

    it("accepts a date-only string, which is what signal_date stores", () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(withPostedAt(today).dimensions.freshness).toBe(100);
    });

    it("accepts an epoch number", () => {
      expect(withPostedAt(Date.now() - 3 * DAY_MS).dimensions.freshness).toBe(100);
    });

    it("scores zero when there is no date to judge", () => {
      expect(withPostedAt(undefined).dimensions.freshness).toBe(0);
      expect(withPostedAt("not a date").dimensions.freshness).toBe(0);
    });

    it("uses the newest date across the signals", () => {
      const result = scoreLead(
        draft({
          signals: [
            signal({ meta: { postedAt: new Date(Date.now() - 90 * DAY_MS) } }),
            signal({ meta: { postedAt: new Date(Date.now() - 2 * DAY_MS) } }),
          ],
        }),
        vertical1HiringRules
      );
      expect(result.dimensions.freshness).toBe(100);
    });
  });

  describe("evidence", () => {
    it("credits a signal that cites a URL", () => {
      const result = scoreLead(
        draft({ signals: [signal({ evidenceUrl: "https://acme.com/jobs/1" })] }),
        vertical1HiringRules
      );
      // 10 of 20 available: the link, but only one source.
      expect(result.dimensions.evidence).toBe(50);
    });

    it("scores zero evidence for a signal with no link", () => {
      expect(scoreLead(draft({ signals: [signal()] }), vertical1HiringRules).dimensions.evidence).toBe(0);
    });

    it("credits corroboration by distinct source, not by signal count", () => {
      const sameSource = scoreLead(
        draft({ signals: [signal(), signal()] }),
        vertical1HiringRules
      );
      expect(sameSource.matchedRules.map((r) => r.id)).not.toContain("multi-source-corroboration");

      const twoSources = scoreLead(
        draft({ signals: [signal(), signal({ sourceConnector: "lever" })] }),
        vertical1HiringRules
      );
      expect(twoSources.matchedRules.map((r) => r.id)).toContain("multi-source-corroboration");
    });

    it("caps corroboration credit", () => {
      const result = scoreLead(
        draft({
          signals: ["greenhouse", "lever", "ashby", "web3career", "hackernews"].map((sourceConnector) =>
            signal({ sourceConnector, evidenceUrl: "https://acme.com/x" })
          ),
        }),
        vertical1HiringRules
      );
      expect(result.dimensions.evidence).toBe(100);
    });
  });

  it("reads meta across every signal rather than only the first", () => {
    const result = scoreLead(
      draft({ signals: [signal(), signal({ meta: { fundingSignal: true } })] }),
      vertical1HiringRules
    );
    expect(result.matchedRules.map((r) => r.id)).toContain("funding-signal");
  });
});

describe("vertical2GeneralRules", () => {
  it("leaves company quality unmeasured rather than scoring every lead zero on it", () => {
    // These leads come from public posts with no funding or headcount data.
    const result = scoreLead(draft({ vertical: "general" }), vertical2GeneralRules);
    expect(result.dimensions.companyQuality).toBeNull();
    expect(result.dimensions.intent).toBe(0);
  });

  it("puts a launch post in fit and engagement in intent", () => {
    const result = scoreLead(
      draft({
        vertical: "general",
        signals: [
          signal({
            vertical: "general",
            sourceConnector: "hackernews",
            meta: { isLaunchPost: true, engagementPoints: 120, numComments: 45 },
          }),
        ],
      }),
      vertical2GeneralRules
    );
    expect(result.dimensions.fit).toBe(100);
    expect(result.dimensions.intent).toBe(100);
  });

  it("decays recency faster than the hiring vertical does", () => {
    // 7 days to full decay at 30, against hiring's 14 to 60.
    const at14Days = scoreLead(
      draft({
        vertical: "general",
        signals: [signal({ vertical: "general", meta: { postedAt: new Date(Date.now() - 14 * DAY_MS) } })],
      }),
      vertical2GeneralRules
    );
    expect(at14Days.dimensions.freshness).toBe(70);

    const at31Days = scoreLead(
      draft({
        vertical: "general",
        signals: [signal({ vertical: "general", meta: { postedAt: new Date(Date.now() - 31 * DAY_MS) } })],
      }),
      vertical2GeneralRules
    );
    expect(at31Days.dimensions.freshness).toBe(0);
  });
});

describe("vertical3CardAffiliateRules", () => {
  it("leaves freshness unmeasured — an agency's client book is not a moment in time", () => {
    const result = scoreLead(draft({ vertical: "card_affiliate" }), vertical3CardAffiliateRules);
    expect(result.dimensions.freshness).toBeNull();
  });

  it("puts crypto client history and channel breadth in fit", () => {
    const result = scoreLead(
      draft({
        vertical: "card_affiliate",
        signals: [signal({ meta: { hasCryptoClientHistory: true, channelsCount: 4 } })],
      }),
      vertical3CardAffiliateRules
    );
    expect(result.dimensions.fit).toBe(100);
    expect(result.dimensions.intent).toBe(0);
  });

  it("requires two or more channels for multi-channel credit", () => {
    const fitFor = (channelsCount: number) =>
      scoreLead(
        draft({ vertical: "card_affiliate", signals: [signal({ meta: { channelsCount } })] }),
        vertical3CardAffiliateRules
      ).matchedRules.map((r) => r.id);

    expect(fitFor(1)).not.toContain("multi-channel");
    expect(fitFor(2)).toContain("multi-channel");
  });

  it("takes the largest channel count across the signals", () => {
    const result = scoreLead(
      draft({
        vertical: "card_affiliate",
        signals: [signal({ meta: { channelsCount: 1 } }), signal({ meta: { channelsCount: 3 } })],
      }),
      vertical3CardAffiliateRules
    );
    expect(result.matchedRules.map((r) => r.id)).toContain("multi-channel");
  });

  it("scores a fully-qualified agency as A+", () => {
    const result = scoreLead(
      draft({
        vertical: "card_affiliate",
        hasNamedContact: true,
        signals: [
          signal({
            sourceConnector: "twitter-agency-signals",
            evidenceUrl: "https://agency.com/about",
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
    expect(result.dimensions).toMatchObject({
      fit: 100,
      intent: 100,
      companyQuality: 100,
      contactability: 100,
      // The X presence and the link, but a single source so no corroboration.
      evidence: 67,
    });
    expect(result.score).toBe(97);
    expect(result.tier).toBe("A+");
  });
});
