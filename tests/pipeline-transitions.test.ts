import { describe, expect, it } from "vitest";
import { moveLeadBetweenColumns, type TransitionColumn } from "../apps/web/lib/pipeline-transitions";

interface TestLead {
  id: string;
  status: string;
  name: string;
}

function columns(): TransitionColumn<TestLead>[] {
  return [
    { status: "new", leads: [{ id: "1", status: "new", name: "Acme" }] },
    { status: "qualified", leads: [{ id: "2", status: "qualified", name: "Globex" }] },
    { status: "won", leads: [] },
  ];
}

describe("moveLeadBetweenColumns", () => {
  it("moves a lead from its source column into the destination column", () => {
    const result = moveLeadBetweenColumns(columns(), "1", "qualified");
    expect(result.find((c) => c.status === "new")!.leads).toEqual([]);
    expect(result.find((c) => c.status === "qualified")!.leads.map((l) => l.id)).toEqual(["1", "2"]);
  });

  it("updates the moved lead's own status field", () => {
    const result = moveLeadBetweenColumns(columns(), "1", "qualified");
    const moved = result.find((c) => c.status === "qualified")!.leads.find((l) => l.id === "1");
    expect(moved?.status).toBe("qualified");
  });

  it("prepends the moved lead to the destination column", () => {
    const result = moveLeadBetweenColumns(columns(), "1", "qualified");
    expect(result.find((c) => c.status === "qualified")!.leads[0].id).toBe("1");
  });

  it("leaves columns untouched by the move (won) alone", () => {
    const result = moveLeadBetweenColumns(columns(), "1", "qualified");
    expect(result.find((c) => c.status === "won")!.leads).toEqual([]);
  });

  it("is a no-op (returns the same reference) when the lead is already in that status", () => {
    const before = columns();
    expect(moveLeadBetweenColumns(before, "1", "new")).toBe(before);
  });

  it("is a no-op when the lead id doesn't exist", () => {
    const before = columns();
    expect(moveLeadBetweenColumns(before, "does-not-exist", "qualified")).toBe(before);
  });

  it("is a no-op when the destination status has no column (a stale or invalid drop target)", () => {
    const before = columns();
    expect(moveLeadBetweenColumns(before, "1", "not_a_pipeline_status")).toBe(before);
  });

  it("does not mutate the input columns array", () => {
    const before = columns();
    const snapshot = JSON.parse(JSON.stringify(before));
    moveLeadBetweenColumns(before, "1", "qualified");
    expect(before).toEqual(snapshot);
  });
});
