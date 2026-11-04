import { describe, it, expect } from "vitest";
import { computeTimelineLayout, dayWidthForZoom, type TimelineTaskLike } from "../timeline";

function task(overrides: Partial<TimelineTaskLike> = {}): TimelineTaskLike {
  return {
    id: "t1",
    startDate: "2026-01-01",
    deadline: "2026-01-05",
    createdAt: "2026-01-01T00:00:00.000Z",
    isOverdue: false,
    completedLate: false,
    ...overrides,
  };
}

describe("computeTimelineLayout", () => {
  it("returns an empty layout anchored on today when there are no tasks", () => {
    const layout = computeTimelineLayout([], "2026-03-01");
    expect(layout.bars).toEqual([]);
    expect(layout.rangeStart).toBe("2026-03-01");
    expect(layout.totalDays).toBe(1);
  });

  it("computes startOffset and span from startDate to deadline", () => {
    const layout = computeTimelineLayout([task()], "2026-01-01");
    expect(layout.bars[0].startOffset).toBe(0);
    expect(layout.bars[0].span).toBe(5);
  });

  it("falls back to createdAt when startDate is null", () => {
    const layout = computeTimelineLayout(
      [task({ startDate: null, createdAt: "2026-01-10T00:00:00.000Z", deadline: "2026-01-12" })],
      "2026-01-10"
    );
    expect(layout.bars[0].startOffset).toBe(0);
    expect(layout.bars[0].span).toBe(3);
  });

  it("falls back to start when deadline is null (span of 1 day minimum)", () => {
    const layout = computeTimelineLayout(
      [task({ startDate: "2026-01-01", deadline: null })],
      "2026-01-01"
    );
    expect(layout.bars[0].span).toBe(1);
  });

  it("computes the range spanning the earliest start and latest deadline across tasks", () => {
    const layout = computeTimelineLayout(
      [
        task({ id: "a", startDate: "2026-01-05", deadline: "2026-01-10" }),
        task({ id: "b", startDate: "2026-01-01", deadline: "2026-01-03" }),
      ],
      "2026-01-01"
    );
    expect(layout.rangeStart).toBe("2026-01-01");
    expect(layout.rangeEnd).toBe("2026-01-10");
    expect(layout.totalDays).toBe(10);

    const barA = layout.bars.find((b) => b.taskId === "a")!;
    expect(barA.startOffset).toBe(4);
    const barB = layout.bars.find((b) => b.taskId === "b")!;
    expect(barB.startOffset).toBe(0);
  });

  it("places the today line at the correct offset within range", () => {
    const layout = computeTimelineLayout(
      [task({ startDate: "2026-01-01", deadline: "2026-01-10" })],
      "2026-01-05"
    );
    expect(layout.todayOffset).toBe(4);
  });

  it("returns null todayOffset when today is outside the computed range", () => {
    const layout = computeTimelineLayout(
      [task({ startDate: "2026-01-01", deadline: "2026-01-05" })],
      "2026-03-01"
    );
    expect(layout.todayOffset).toBeNull();
  });

  it("carries isOverdue and completedLate flags onto bars for red/marked rendering", () => {
    const layout = computeTimelineLayout(
      [task({ isOverdue: true }), task({ id: "t2", completedLate: true })],
      "2026-01-01"
    );
    expect(layout.bars.find((b) => b.taskId === "t1")?.isOverdue).toBe(true);
    expect(layout.bars.find((b) => b.taskId === "t2")?.completedLate).toBe(true);
  });
});

describe("dayWidthForZoom", () => {
  it("returns a wider day column for day zoom than week zoom", () => {
    expect(dayWidthForZoom("day")).toBeGreaterThan(dayWidthForZoom("week"));
  });
});
