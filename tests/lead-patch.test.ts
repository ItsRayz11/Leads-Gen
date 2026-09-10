import { describe, expect, it } from "vitest";
import { BULK_EDITABLE_FIELDS, buildLeadPatch } from "../apps/web/lib/data/lead-patch";

describe("buildLeadPatch — status transitions", () => {
  it("accepts a status change with no restriction on which status", () => {
    expect(buildLeadPatch({ status: "won" })).toEqual({ status: "won" });
    expect(buildLeadPatch({ status: "lost" })).toEqual({ status: "lost" });
  });

  it("trims whitespace around a status value", () => {
    expect(buildLeadPatch({ status: "  qualified  " })).toEqual({ status: "qualified" });
  });

  it("ignores a blank status — status is NOT NULL, so clearing it isn't a thing", () => {
    expect(buildLeadPatch({ status: "   " })).toEqual({});
  });

  it("allows status through the bulk-edit allowlist", () => {
    expect(buildLeadPatch({ status: "contacted" }, BULK_EDITABLE_FIELDS)).toEqual({ status: "contacted" });
  });

  it("drops a field the caller's allowlist excludes, even if it's editable in general", () => {
    // `title` is editable one-lead-at-a-time but not in BULK_EDITABLE_FIELDS.
    expect(buildLeadPatch({ status: "won", title: "New title" }, BULK_EDITABLE_FIELDS)).toEqual({ status: "won" });
  });
});

describe("buildLeadPatch — field handling", () => {
  it("drops unknown keys", () => {
    expect(buildLeadPatch({ status: "won", not_a_real_column: "x" })).toEqual({ status: "won" });
  });

  it("returns an empty patch for an empty body", () => {
    expect(buildLeadPatch({})).toEqual({});
  });

  it.each([
    [50, 50],
    ["75", 75],
    [-10, 0],
    [150, 100],
    [42.6, 43],
  ])("clamps and rounds score %j to %j", (input, expected) => {
    expect(buildLeadPatch({ score: input })).toEqual({ score: expected });
  });

  it("drops a non-numeric score", () => {
    expect(buildLeadPatch({ score: "not a number" })).toEqual({});
  });

  it.each(["tier", "owner", "recommended_offer"] as const)(
    "clears a nullable field (%s) when given an empty string",
    (field) => {
      expect(buildLeadPatch({ [field]: "  " })).toEqual({ [field]: null });
    }
  );

  it("ignores a blank value for a non-nullable field like title", () => {
    expect(buildLeadPatch({ title: "  " })).toEqual({});
  });

  it("passes an explicit null through for a nullable field", () => {
    expect(buildLeadPatch({ primary_contact_id: null })).toEqual({ primary_contact_id: null });
  });

  it("passes a non-string, non-null value through unchanged (no type coercion beyond score)", () => {
    // buildLeadPatch doesn't validate field types beyond score/string handling —
    // whatever isn't a string, null, or undefined is assigned as-is.
    expect(buildLeadPatch({ owner: true })).toEqual({ owner: true });
  });

  it("only includes fields actually present on the body, not every editable field", () => {
    expect(buildLeadPatch({ owner: "alex" })).toEqual({ owner: "alex" });
  });
});
