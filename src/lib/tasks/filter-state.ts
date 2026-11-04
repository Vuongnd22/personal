export type TaskView = "list" | "kanban" | "timeline" | "calendar";

export interface TaskFilterState {
  view: TaskView;
  productId?: string;
  featureId?: string;
  assigneeId?: string;
  status?: string[];
  priority?: string[];
  overdueOnly?: boolean;
  from?: string;
  to?: string;
  search?: string;
  tab?: string;
}

const VALID_VIEWS: TaskView[] = ["list", "kanban", "timeline", "calendar"];

function isTaskView(value: string | null): value is TaskView {
  return value !== null && (VALID_VIEWS as string[]).includes(value);
}

export function parseFilterState(params: URLSearchParams): TaskFilterState {
  const view = params.get("view");
  const state: TaskFilterState = {
    view: isTaskView(view) ? view : "list",
  };

  const productId = params.get("productId");
  if (productId) state.productId = productId;

  const featureId = params.get("feature") ?? params.get("featureId");
  if (featureId) state.featureId = featureId;

  const assigneeId = params.get("assigneeId");
  if (assigneeId) state.assigneeId = assigneeId;

  const status = params.get("status");
  if (status) state.status = status.split(",").filter(Boolean);

  const priority = params.get("priority");
  if (priority) state.priority = priority.split(",").filter(Boolean);

  const overdueOnly = params.get("overdueOnly");
  if (overdueOnly === "true") state.overdueOnly = true;

  const from = params.get("from");
  if (from) state.from = from;

  const to = params.get("to");
  if (to) state.to = to;

  const search = params.get("search");
  if (search) state.search = search;

  const tab = params.get("tab");
  if (tab) state.tab = tab;

  return state;
}

export function serializeFilterState(state: TaskFilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.view !== "list") params.set("view", state.view);
  if (state.productId) params.set("productId", state.productId);
  if (state.featureId) params.set("feature", state.featureId);
  if (state.assigneeId) params.set("assigneeId", state.assigneeId);
  if (state.status && state.status.length > 0) params.set("status", state.status.join(","));
  if (state.priority && state.priority.length > 0) params.set("priority", state.priority.join(","));
  if (state.overdueOnly) params.set("overdueOnly", "true");
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.search) params.set("search", state.search);
  if (state.tab) params.set("tab", state.tab);

  return params;
}
