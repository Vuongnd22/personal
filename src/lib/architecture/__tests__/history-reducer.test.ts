import { describe, it, expect } from "vitest";
import {
  createHistoryState,
  historyReducer,
  isDirty,
  canUndo,
  canRedo,
  HISTORY_CAP,
  type CanvasSnapshot,
  type HistoryState,
} from "../history-reducer";

function snapshot(n: number): CanvasSnapshot {
  return {
    nodes: [{ id: `n${n}`, type: "product", position: { x: n, y: 0 }, data: {} }] as never,
    edges: [],
  };
}

describe("historyReducer", () => {
  it("starts clean: no undo/redo, not dirty", () => {
    const state = createHistoryState(snapshot(0));
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
    expect(isDirty(state)).toBe(false);
  });

  it("PUSH moves present into past and becomes dirty", () => {
    const state = createHistoryState(snapshot(0));
    const next = historyReducer(state, { type: "PUSH", snapshot: snapshot(1) });
    expect(next.present).toEqual(snapshot(1));
    expect(next.past).toHaveLength(1);
    expect(isDirty(next)).toBe(true);
  });

  it("UNDO restores the previous snapshot and enables redo", () => {
    let state = createHistoryState(snapshot(0));
    state = historyReducer(state, { type: "PUSH", snapshot: snapshot(1) });
    state = historyReducer(state, { type: "UNDO" });

    expect(state.present).toEqual(snapshot(0));
    expect(canRedo(state)).toBe(true);
    expect(canUndo(state)).toBe(false);
  });

  it("REDO re-applies the undone snapshot", () => {
    let state = createHistoryState(snapshot(0));
    state = historyReducer(state, { type: "PUSH", snapshot: snapshot(1) });
    state = historyReducer(state, { type: "UNDO" });
    state = historyReducer(state, { type: "REDO" });

    expect(state.present).toEqual(snapshot(1));
    expect(canRedo(state)).toBe(false);
    expect(canUndo(state)).toBe(true);
  });

  it("UNDO is a no-op at the start of history", () => {
    const state = createHistoryState(snapshot(0));
    const next = historyReducer(state, { type: "UNDO" });
    expect(next).toBe(state);
  });

  it("REDO is a no-op when there is nothing to redo", () => {
    const state = createHistoryState(snapshot(0));
    const next = historyReducer(state, { type: "REDO" });
    expect(next).toBe(state);
  });

  it("a new PUSH after UNDO clears the redo stack", () => {
    let state = createHistoryState(snapshot(0));
    state = historyReducer(state, { type: "PUSH", snapshot: snapshot(1) });
    state = historyReducer(state, { type: "UNDO" });
    expect(canRedo(state)).toBe(true);

    state = historyReducer(state, { type: "PUSH", snapshot: snapshot(2) });
    expect(canRedo(state)).toBe(false);
    expect(state.present).toEqual(snapshot(2));
  });

  it("caps the past stack at HISTORY_CAP entries", () => {
    let state = createHistoryState(snapshot(0));
    for (let i = 1; i <= HISTORY_CAP + 10; i++) {
      state = historyReducer(state, { type: "PUSH", snapshot: snapshot(i) });
    }
    expect(state.past.length).toBe(HISTORY_CAP);
    expect(state.past[0]).toEqual(snapshot(10));
  });

  it("MARK_SAVED clears dirty state at the current present", () => {
    let state = createHistoryState(snapshot(0));
    state = historyReducer(state, { type: "PUSH", snapshot: snapshot(1) });
    expect(isDirty(state)).toBe(true);

    state = historyReducer(state, { type: "MARK_SAVED" });
    expect(isDirty(state)).toBe(false);
  });

  it("becomes dirty again after a further change post-save", () => {
    let state = createHistoryState(snapshot(0));
    state = historyReducer(state, { type: "PUSH", snapshot: snapshot(1) });
    state = historyReducer(state, { type: "MARK_SAVED" });
    state = historyReducer(state, { type: "PUSH", snapshot: snapshot(2) });
    expect(isDirty(state)).toBe(true);
  });

  it("undoing back to the saved snapshot becomes clean again", () => {
    let state: HistoryState = createHistoryState(snapshot(0));
    state = historyReducer(state, { type: "PUSH", snapshot: snapshot(1) });
    state = historyReducer(state, { type: "MARK_SAVED" });
    state = historyReducer(state, { type: "PUSH", snapshot: snapshot(2) });
    state = historyReducer(state, { type: "UNDO" });
    expect(state.present).toEqual(snapshot(1));
    expect(isDirty(state)).toBe(false);
  });
});
