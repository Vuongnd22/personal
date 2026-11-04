import type { DiagramNode, DiagramEdge } from "./diagram-mapping";

export interface CanvasSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface HistoryState {
  past: CanvasSnapshot[];
  present: CanvasSnapshot;
  future: CanvasSnapshot[];
  savedSnapshot: CanvasSnapshot;
}

export type HistoryAction =
  | { type: "PUSH"; snapshot: CanvasSnapshot }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "MARK_SAVED" };

export const HISTORY_CAP = 100;

export function createHistoryState(initial: CanvasSnapshot): HistoryState {
  return {
    past: [],
    present: initial,
    future: [],
    savedSnapshot: initial,
  };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "PUSH": {
      const past = [...state.past, state.present].slice(-HISTORY_CAP);
      return {
        ...state,
        past,
        present: action.snapshot,
        future: [],
      };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const past = state.past.slice(0, -1);
      return {
        ...state,
        past,
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const future = state.future.slice(1);
      return {
        ...state,
        past: [...state.past, state.present],
        present: next,
        future,
      };
    }
    case "MARK_SAVED": {
      return { ...state, savedSnapshot: state.present };
    }
    default:
      return state;
  }
}

export function isDirty(state: HistoryState): boolean {
  return state.present !== state.savedSnapshot;
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}
