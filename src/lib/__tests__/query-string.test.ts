import { describe, it, expect } from "vitest";
import { buildQueryString } from "../query-string";

describe("buildQueryString", () => {
  it("returns empty string for no params", () => {
    expect(buildQueryString({})).toBe("");
  });

  it("skips undefined, null, and empty string values", () => {
    expect(buildQueryString({ a: undefined, b: null, c: "" })).toBe("");
  });

  it("serializes string, number, and boolean values", () => {
    const qs = buildQueryString({ search: "wifi", page: 2, overdue: true });
    const params = new URLSearchParams(qs.slice(1));
    expect(params.get("search")).toBe("wifi");
    expect(params.get("page")).toBe("2");
    expect(params.get("overdue")).toBe("true");
  });

  it("prefixes with ? when there are params", () => {
    expect(buildQueryString({ a: "1" })).toBe("?a=1");
  });

  it("omits false boolean values is not skipped (false is a real value)", () => {
    expect(buildQueryString({ overdue: false })).toBe("?overdue=false");
  });
});
