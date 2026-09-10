import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  pageRange,
  queryString,
  rangeFor,
  resolvePage,
  resolvePerPage,
  single,
} from "../apps/web/lib/paging";

describe("resolvePerPage", () => {
  it.each(PAGE_SIZES)("accepts the offered size %i", (size) => {
    expect(resolvePerPage(String(size))).toBe(size);
  });

  it.each([undefined, "", "0", "-25", "10", "1000", "abc"])(
    "falls back to the default for %j",
    (value) => {
      // A stale bookmark or a hand-edited URL should still open the list.
      expect(resolvePerPage(value)).toBe(DEFAULT_PAGE_SIZE);
    }
  );

  it("takes the leading integer of a decimal, as parseInt does", () => {
    expect(resolvePerPage("25.5")).toBe(25);
  });
});

describe("resolvePage", () => {
  it("reads a positive page number", () => {
    expect(resolvePage("7")).toBe(7);
  });

  it.each([undefined, "", "0", "-3", "abc", "NaN"])("falls back to page 1 for %j", (value) => {
    expect(resolvePage(value)).toBe(1);
  });

  it("takes the leading integer of a decimal, as parseInt does", () => {
    expect(resolvePage("2.9")).toBe(2);
  });
});

describe("pageRange", () => {
  it("returns an inclusive range for the first page", () => {
    expect(pageRange(1, 25)).toEqual({ from: 0, to: 24 });
  });

  it("offsets by whole pages", () => {
    expect(pageRange(3, 50)).toEqual({ from: 100, to: 149 });
  });

  it("treats a page below 1 as the first page", () => {
    expect(pageRange(0, 25)).toEqual({ from: 0, to: 24 });
    expect(pageRange(-5, 25)).toEqual({ from: 0, to: 24 });
  });

  it("spans exactly perPage rows", () => {
    const { from, to } = pageRange(4, 200);
    expect(to - from + 1).toBe(200);
  });
});

describe("rangeFor", () => {
  it("defaults to the first page at the default size", () => {
    expect(rangeFor()).toEqual({ from: 0, to: DEFAULT_PAGE_SIZE - 1 });
    expect(rangeFor({})).toEqual({ from: 0, to: DEFAULT_PAGE_SIZE - 1 });
  });

  it("uses the options it is given", () => {
    expect(rangeFor({ page: 2, perPage: 25 })).toEqual({ from: 25, to: 49 });
  });

  it("defaults only the missing half", () => {
    expect(rangeFor({ perPage: 100 })).toEqual({ from: 0, to: 99 });
    expect(rangeFor({ page: 3 })).toEqual({
      from: 2 * DEFAULT_PAGE_SIZE,
      to: 3 * DEFAULT_PAGE_SIZE - 1,
    });
  });
});

describe("single", () => {
  it("returns a plain value", () => {
    expect(single({ q: "acme" }, "q")).toBe("acme");
  });

  it("returns the first of a repeated param", () => {
    expect(single({ q: ["acme", "globex"] }, "q")).toBe("acme");
  });

  it("returns undefined for a missing key or an empty array", () => {
    expect(single({}, "q")).toBeUndefined();
    expect(single({ q: [] }, "q")).toBeUndefined();
  });
});

describe("queryString", () => {
  it("round-trips the params a pager link needs to preserve", () => {
    expect(queryString({ q: "acme", page: "2", perPage: "25" })).toBe("q=acme&page=2&perPage=25");
  });

  it("drops undefined values rather than emitting empty params", () => {
    expect(queryString({ q: "acme", country: undefined })).toBe("q=acme");
  });

  it("keeps the first of a repeated param", () => {
    expect(queryString({ q: ["acme", "globex"] })).toBe("q=acme");
  });

  it("encodes values that need it", () => {
    expect(queryString({ q: "acme labs & co" })).toBe("q=acme+labs+%26+co");
  });

  it("returns an empty string for no params", () => {
    expect(queryString({})).toBe("");
  });
});
