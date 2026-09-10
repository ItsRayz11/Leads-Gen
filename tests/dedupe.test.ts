import { describe, expect, it } from "vitest";
import type { RawSignal, Vertical } from "@leads/core";
import { freshnessFromDate, groupSignalsByCompany, normalizeDomain } from "../workers/pipeline/shared";

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

/** Group keys, for asserting how many companies a signal set collapsed into. */
function keys(signals: RawSignal[]): string[] {
  return [...groupSignalsByCompany(signals).keys()];
}

describe("normalizeDomain", () => {
  it.each([
    ["example.com", "example.com"],
    ["www.example.com", "example.com"],
    ["WWW.Example.com", "example.com"],
    ["https://www.Example.com/careers", "example.com"],
    ["http://example.com", "example.com"],
    ["sub.example.com", "sub.example.com"],
    ["example.com:8080/path", "example.com"],
    ["  example.com  ", "example.com"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each([null, undefined, "", "   ", "not a url"])("returns null for %j", (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });

  it("does not mistake an upper-cased scheme for the hostname", () => {
    // Regression: a case-sensitive startsWith("http") check meant
    // "HTTP://acme.com" had "https://" prefixed onto it and parsed as the
    // hostname "http", so every company with an upper-cased URL keyed to the
    // same bogus domain and got merged into one record.
    expect(normalizeDomain("HTTP://EXAMPLE.COM")).toBe("example.com");
    expect(normalizeDomain("HTTPS://WWW.Acme.io/")).toBe("acme.io");
    expect(normalizeDomain("HTTP://a.com")).not.toBe(normalizeDomain("HTTP://b.com"));
  });

  it("returns null for a non-web scheme rather than its scheme name", () => {
    expect(normalizeDomain("ftp://example.com/x")).toBeNull();
  });
});

describe("groupSignalsByCompany", () => {
  it("returns no groups for no signals", () => {
    expect(groupSignalsByCompany([]).size).toBe(0);
  });

  it("groups two signals with the same domain into one company", () => {
    const grouped = groupSignalsByCompany([
      signal({ website: "https://acme.com", sourceConnector: "greenhouse" }),
      signal({ website: "http://www.ACME.com/jobs", sourceConnector: "lever" }),
    ]);
    expect(grouped.size).toBe(1);
    expect([...grouped.values()][0]).toHaveLength(2);
  });

  it("groups by domain even when the project names differ", () => {
    // The same company posting under a trading name and a legal name is one
    // company; the domain is what settles it.
    const grouped = groupSignalsByCompany([
      signal({ projectName: "Acme", website: "acme.com" }),
      signal({ projectName: "Acme Labs Inc", website: "acme.com" }),
    ]);
    expect(grouped.size).toBe(1);
  });

  it("keeps different domains apart", () => {
    expect(keys([signal({ website: "acme.com" }), signal({ website: "globex.com" })])).toEqual([
      "hiring::acme.com",
      "hiring::globex.com",
    ]);
  });

  it("falls back to a normalized project name when there is no website", () => {
    expect(keys([signal({ projectName: "  Acme Labs  " })])).toEqual(["hiring::acme labs"]);
  });

  it("groups by name case-insensitively when neither signal has a website", () => {
    const grouped = groupSignalsByCompany([
      signal({ projectName: "Acme" }),
      signal({ projectName: "ACME" }),
    ]);
    expect(grouped.size).toBe(1);
  });

  it("falls back to the name when the website is unparseable", () => {
    expect(keys([signal({ projectName: "Acme", website: "not a url" })])).toEqual(["hiring::acme"]);
  });

  it("keeps the same company in two verticals as two opportunities", () => {
    // An agency can be both a hiring lead and a card-affiliate lead; those are
    // separate opportunities, so the vertical is part of the key.
    expect(
      keys([
        signal({ website: "acme.com", vertical: "hiring" }),
        signal({ website: "acme.com", vertical: "card_affiliate" }),
      ])
    ).toEqual(["hiring::acme.com", "card_affiliate::acme.com"]);
  });

  it("preserves signal order inside a group", () => {
    const grouped = groupSignalsByCompany([
      signal({ website: "acme.com", signalText: "first" }),
      signal({ website: "acme.com", signalText: "second" }),
      signal({ website: "acme.com", signalText: "third" }),
    ]);
    expect([...grouped.values()][0].map((s) => s.signalText)).toEqual(["first", "second", "third"]);
  });

  it("does not join a signal that has a website to one that only has the same name", () => {
    // A known limit of keying on domain-or-name: the connector that found a
    // website and the one that did not produce two groups, which the pipeline
    // then resolves to one company only if the name lookup happens to match.
    expect(
      keys([signal({ projectName: "Acme", website: "acme.com" }), signal({ projectName: "Acme" })])
    ).toEqual(["hiring::acme.com", "hiring::acme"]);
  });

  it("keys every vertical the app supports", () => {
    const verticals: Vertical[] = ["hiring", "general", "card_affiliate"];
    expect(keys(verticals.map((vertical) => signal({ vertical, website: "acme.com" })))).toEqual(
      verticals.map((vertical) => `${vertical}::acme.com`)
    );
  });
});

describe("freshnessFromDate", () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

  it.each([
    [0, "fresh"],
    [6, "fresh"],
    [8, "recent"],
    [29, "recent"],
    [31, "aging"],
    [89, "aging"],
    [91, "stale"],
    [365, "stale"],
  ])("calls a signal from %i day(s) ago %s", (days, expected) => {
    expect(freshnessFromDate(daysAgo(days))).toBe(expected);
  });

  it.each([null, undefined])("returns unknown for %j", (input) => {
    expect(freshnessFromDate(input)).toBe("unknown");
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(freshnessFromDate(daysAgo(2).toISOString())).toBe("fresh");
  });

  it("treats a future date as fresh", () => {
    expect(freshnessFromDate(new Date(Date.now() + 5 * DAY_MS))).toBe("fresh");
  });
});
