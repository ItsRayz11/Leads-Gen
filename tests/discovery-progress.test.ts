import { describe, expect, it, vi } from "vitest";
import { errorMessage, runConnectors, safeReporter, type ProgressEvent } from "../workers/pipeline/progress";
import { runStatus } from "../workers/pipeline/shared";

type FakeConnector = { name: string; enabled: boolean };

function connector(name: string, enabled = true): FakeConnector {
  return { name, enabled };
}

/** Collects everything a run reports, in order. */
function recorder() {
  const events: ProgressEvent[] = [];
  return { events, report: (e: ProgressEvent) => events.push(e) };
}

describe("safeReporter", () => {
  it("is a no-op when no reporter is supplied", () => {
    expect(() => safeReporter()({ type: "stage", stage: "done", message: "x" })).not.toThrow();
  });

  it("swallows a throwing sink so a dead client can't abort the run", () => {
    const report = safeReporter(() => {
      throw new Error("client went away");
    });
    expect(() => report({ type: "stage", stage: "done", message: "x" })).not.toThrow();
  });

  it("forwards events to a working sink", () => {
    const { events, report } = recorder();
    safeReporter(report)({ type: "stage", stage: "starting", message: "go" });
    expect(events).toEqual([{ type: "stage", stage: "starting", message: "go" }]);
  });
});

describe("errorMessage", () => {
  it.each([
    [new Error("boom"), "boom"],
    ["plain string", "plain string"],
    [{ weird: true }, "Unknown error"],
    [null, "Unknown error"],
  ])("renders %j as a message", (input, expected) => {
    expect(errorMessage(input)).toBe(expected);
  });
});

describe("runConnectors", () => {
  it("collects signals from every enabled connector", async () => {
    const { events, report } = recorder();
    const { signals, connectorCounts } = await runConnectors<FakeConnector, string>(
      [connector("a"), connector("b")],
      async (c) => (c.name === "a" ? ["s1", "s2"] : ["s3"]),
      report
    );

    expect(signals).toEqual(["s1", "s2", "s3"]);
    expect(connectorCounts).toEqual([
      { connector: "a", signalsFound: 2, note: undefined },
      { connector: "b", signalsFound: 1, note: undefined },
    ]);
    expect(events.filter((e) => e.type === "connector:start")).toHaveLength(2);
  });

  it("records a failing connector instead of dropping it from the summary", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { events, report } = recorder();

    const { signals, connectorCounts } = await runConnectors<FakeConnector, string>(
      [connector("good"), connector("bad")],
      async (c) => {
        if (c.name === "bad") throw new Error("rate limited");
        return ["s1"];
      },
      report
    );

    expect(signals).toEqual(["s1"]);
    expect(connectorCounts).toContainEqual({ connector: "bad", signalsFound: 0, error: "rate limited" });
    expect(events).toContainEqual({ type: "connector:error", connector: "bad", error: "rate limited" });
    consoleError.mockRestore();
  });

  it("keeps going after a failure so one bad source can't lose the others' work", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { signals } = await runConnectors<FakeConnector, string>(
      [connector("bad"), connector("good")],
      async (c) => {
        if (c.name === "bad") throw new Error("down");
        return ["kept"];
      },
      () => {}
    );
    expect(signals).toEqual(["kept"]);
    consoleError.mockRestore();
  });

  it("reports a disabled connector as skipped and never calls it", async () => {
    const fetchOne = vi.fn(async () => ["never"]);
    const { events, report } = recorder();
    const { connectorCounts, signals } = await runConnectors<FakeConnector, string>(
      [connector("off", false)],
      fetchOne,
      report
    );

    expect(fetchOne).not.toHaveBeenCalled();
    expect(signals).toEqual([]);
    // A skipped connector contributes no count — it never had a chance to
    // find anything, so reporting "0 signals" would misrepresent it.
    expect(connectorCounts).toEqual([]);
    expect(events).toEqual([{ type: "connector:skipped", connector: "off", reason: "disabled" }]);
  });

  it("attaches a zero-result note only when a connector actually found nothing", async () => {
    const { connectorCounts } = await runConnectors<FakeConnector, string>(
      [connector("empty"), connector("full")],
      async (c) => (c.name === "empty" ? [] : ["s"]),
      () => {},
      async (name) => (name === "empty" ? "no API key configured" : "should not be asked")
    );

    expect(connectorCounts).toEqual([
      { connector: "empty", signalsFound: 0, note: "no API key configured" },
      { connector: "full", signalsFound: 1, note: undefined },
    ]);
  });

  it("emits start before done for each connector", async () => {
    const { events, report } = recorder();
    await runConnectors<FakeConnector, string>([connector("a")], async () => ["s"], report);
    expect(events.map((e) => e.type)).toEqual(["connector:start", "connector:done"]);
  });
});

describe("runStatus", () => {
  it("is completed when every connector returned cleanly", () => {
    expect(runStatus([{ connector: "a", signalsFound: 3 }])).toBe("completed");
  });

  it("warns when a connector failed", () => {
    expect(runStatus([{ connector: "a", signalsFound: 0, error: "boom" }])).toBe("completed_with_warnings");
  });

  it("warns when a connector explained an empty result", () => {
    expect(runStatus([{ connector: "a", signalsFound: 0, note: "no API key" }])).toBe("completed_with_warnings");
  });

  it("is completed for an empty run with nothing to warn about", () => {
    expect(runStatus([])).toBe("completed");
  });
});
