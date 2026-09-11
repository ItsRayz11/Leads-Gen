import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchConfig } from "@leads/core";
import { hackerNewsConnector } from "../workers/connectors/generic/hackernews";

/** The query strings handed to the HN API across one fetch() call. */
let queries: URLSearchParams[];

beforeEach(() => {
  queries = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      queries.push(new URL(url).searchParams);
      return {
        ok: true,
        json: async () => ({ hits: [] }),
      } as unknown as Response;
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function run(config: Partial<SearchConfig>): Promise<void> {
  await hackerNewsConnector.fetch({ vertical: "general", ...config } as SearchConfig);
}

/** Every `query` parameter sent, in order. */
function sentQueries(): string[] {
  return queries.map((q) => q.get("query") ?? "");
}

describe("hackerNewsConnector query construction", () => {
  it("wraps each keyword in quotes so it matches as an exact phrase", async () => {
    await run({ keywords: ["Launch HN"] });
    expect(sentQueries()).toEqual(['"Launch HN"']);
  });

  it("disables typo tolerance and enables advanced syntax", async () => {
    // Without these, Algolia resolves "web3" to WebGPU/WebAudio/webcams.
    await run({ keywords: ["web3"] });
    expect(queries[0].get("advancedSyntax")).toBe("true");
    expect(queries[0].get("typoTolerance")).toBe("false");
  });

  it("strips quotes already in a keyword instead of nesting them", async () => {
    await run({ keywords: ['"Launch HN"'] });
    expect(sentQueries()).toEqual(['"Launch HN"']);
  });

  it("issues one search per keyword", async () => {
    await run({ keywords: ["Launch HN", "YC S26"] });
    expect(sentQueries()).toEqual(['"Launch HN"', '"YC S26"']);
  });

  it("searches industries as well as keywords, so the Industry filter is not decorative", async () => {
    await run({ keywords: ["Launch HN"], industries: ["Fintech"] });
    expect(sentQueries()).toEqual(['"Launch HN"', '"Fintech"']);
  });

  it("searches industries even when no keywords were given", async () => {
    await run({ industries: ["Robotics"] });
    expect(sentQueries()).toEqual(['"Robotics"']);
  });

  it("does not search a term twice when it appears as both keyword and industry", async () => {
    await run({ keywords: ["Fintech"], industries: ["Fintech"] });
    expect(sentQueries()).toEqual(['"Fintech"']);
  });

  it("ignores geography rather than matching posts that merely mention a place", async () => {
    await run({ keywords: ["Launch HN"], geography: ["Pakistan", "Singapore"] });
    expect(sentQueries()).toEqual(['"Launch HN"']);
  });

  it("searches nothing when there is nothing to search for", async () => {
    await run({});
    expect(sentQueries()).toEqual([]);
  });

  it("restricts results to stories within the lookback window", async () => {
    await run({ keywords: ["Launch HN"] });
    expect(queries[0].get("tags")).toBe("story");
    expect(queries[0].get("numericFilters")).toMatch(/^created_at_i>\d+$/);
  });
});

describe("hackerNewsConnector result handling", () => {
  /** Replaces the stub with one returning fixed hits. */
  function stubHits(hits: unknown[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ hits }) }) as unknown as Response)
    );
  }

  it("drops a hit whose title contains an excluded keyword", async () => {
    stubHits([
      { objectID: "1", title: "Launch HN: Real Co (YC S26)", url: null, author: "a", created_at: new Date().toISOString(), points: 5, num_comments: 1 },
      { objectID: "2", title: "Ask HN: Who is hiring?", url: null, author: "b", created_at: new Date().toISOString(), points: 5, num_comments: 1 },
    ]);
    const signals = await hackerNewsConnector.fetch({
      vertical: "general",
      keywords: ["Launch HN"],
      excludeKeywords: ["who is hiring"],
    } as SearchConfig);

    expect(signals.map((s) => s.projectName)).toEqual(["Real Co (YC S26)"]);
  });

  it("does not emit the same story twice when two keywords both match it", async () => {
    stubHits([
      { objectID: "dup", title: "Launch HN: Same Co (YC S26)", url: null, author: "a", created_at: new Date().toISOString(), points: 5, num_comments: 1 },
    ]);
    const signals = await hackerNewsConnector.fetch({
      vertical: "general",
      keywords: ["Launch HN", "YC S26"],
    } as SearchConfig);

    expect(signals).toHaveLength(1);
  });

  it("records a citable evidence URL for every signal", async () => {
    stubHits([
      { objectID: "42", title: "Launch HN: Cited Co (YC S26)", url: null, author: "a", created_at: new Date().toISOString(), points: 5, num_comments: 1 },
    ]);
    const signals = await hackerNewsConnector.fetch({ vertical: "general", keywords: ["Launch HN"] } as SearchConfig);
    expect(signals[0].evidenceUrl).toBe("https://news.ycombinator.com/item?id=42");
  });

  it("raises a useful error when the API itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as unknown as Response));
    await expect(
      hackerNewsConnector.fetch({ vertical: "general", keywords: ["Launch HN"] } as SearchConfig)
    ).rejects.toThrow(/503/);
  });
});
