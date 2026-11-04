import { describe, it, expect } from "vitest";
import { parseFilterState, serializeFilterState } from "../filter-state";

describe("parseFilterState", () => {
  it("defaults to list view when no view param is present", () => {
    const state = parseFilterState(new URLSearchParams());
    expect(state.view).toBe("list");
  });

  it("parses a valid view param", () => {
    const state = parseFilterState(new URLSearchParams("view=kanban"));
    expect(state.view).toBe("kanban");
  });

  it("falls back to list for an invalid view value", () => {
    const state = parseFilterState(new URLSearchParams("view=bogus"));
    expect(state.view).toBe("list");
  });

  it("splits comma-separated status and priority lists", () => {
    const state = parseFilterState(new URLSearchParams("status=TODO,OVERDUE&priority=HIGH,URGENT"));
    expect(state.status).toEqual(["TODO", "OVERDUE"]);
    expect(state.priority).toEqual(["HIGH", "URGENT"]);
  });

  it("parses the feature filter from either feature or featureId param", () => {
    expect(parseFilterState(new URLSearchParams("feature=f1")).featureId).toBe("f1");
    expect(parseFilterState(new URLSearchParams("featureId=f2")).featureId).toBe("f2");
  });

  it("parses overdueOnly only when exactly 'true'", () => {
    expect(parseFilterState(new URLSearchParams("overdueOnly=true")).overdueOnly).toBe(true);
    expect(parseFilterState(new URLSearchParams("overdueOnly=1")).overdueOnly).toBeUndefined();
  });

  it("parses date range and search and tab", () => {
    const state = parseFilterState(
      new URLSearchParams("from=2026-01-01&to=2026-01-31&search=wifi&tab=tasks")
    );
    expect(state.from).toBe("2026-01-01");
    expect(state.to).toBe("2026-01-31");
    expect(state.search).toBe("wifi");
    expect(state.tab).toBe("tasks");
  });

  it("omits keys that are not present rather than setting empty values", () => {
    const state = parseFilterState(new URLSearchParams());
    expect(state).not.toHaveProperty("status");
    expect(state).not.toHaveProperty("search");
  });
});

describe("serializeFilterState", () => {
  it("omits the view param when it is the default (list)", () => {
    const params = serializeFilterState({ view: "list" });
    expect(params.has("view")).toBe(false);
  });

  it("includes non-default view", () => {
    const params = serializeFilterState({ view: "calendar" });
    expect(params.get("view")).toBe("calendar");
  });

  it("joins status/priority arrays back into comma lists", () => {
    const params = serializeFilterState({
      view: "list",
      status: ["TODO", "OVERDUE"],
      priority: ["HIGH"],
    });
    expect(params.get("status")).toBe("TODO,OVERDUE");
    expect(params.get("priority")).toBe("HIGH");
  });

  it("serializes featureId under the 'feature' key", () => {
    const params = serializeFilterState({ view: "list", featureId: "f1" });
    expect(params.get("feature")).toBe("f1");
    expect(params.has("featureId")).toBe(false);
  });

  it("round-trips through parse -> serialize -> parse", () => {
    const original = new URLSearchParams(
      "view=kanban&productId=p1&feature=f1&status=TODO,REVIEW&priority=LOW&overdueOnly=true&from=2026-01-01&to=2026-02-01&search=lte&tab=tasks"
    );
    const state = parseFilterState(original);
    const serialized = serializeFilterState(state);
    const reparsed = parseFilterState(serialized);
    expect(reparsed).toEqual(state);
  });

  it("omits empty arrays and falsy flags", () => {
    const params = serializeFilterState({ view: "list", status: [], overdueOnly: false });
    expect(params.has("status")).toBe(false);
    expect(params.has("overdueOnly")).toBe(false);
  });
});
