export type Role = "ADMIN" | "MANAGER" | "MEMBER";
export type ProductStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
export type EffectiveTaskStatus = TaskStatus | "OVERDUE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type NodeKind = "PRODUCT" | "MODULE" | "NOTE";
export type EdgeDirection = "FORWARD" | "BACKWARD" | "BOTH" | "NONE";
export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_COMMENTED"
  | "TASK_STATUS_CHANGED"
  | "TASK_OVERDUE";

export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export interface User extends UserRef {
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface ProductRef {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Counts {
  taskCount: number;
  completedCount: number;
  overdueCount: number;
  progress: number;
}

export interface ProductSummary extends ProductRef, Counts {
  description: string;
  status: ProductStatus;
  owner: UserRef | null;
  startDate: string | null;
  deadline: string | null;
  featureCount: number;
  lastActivityAt: string;
  createdAt: string;
}

export interface FeatureSummary extends Counts {
  id: string;
  productId: string;
  name: string;
  description: string;
  category: string;
  owner: UserRef | null;
  startDate: string | null;
  deadline: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  effectiveStatus: EffectiveTaskStatus;
  isOverdue: boolean;
  priority: TaskPriority;
  startDate: string | null;
  deadline: string | null;
  completedAt: string | null;
  completedLate: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  feature: { id: string; name: string; category: string };
  product: ProductRef;
  assignee: UserRef | null;
  creator: UserRef;
  checklist: { done: number; total: number };
  commentCount: number;
  attachmentCount: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  sortOrder: number;
}

export interface TaskDetail extends Task {
  checklistItems: ChecklistItem[];
}

export interface Comment {
  id: string;
  body: string;
  author: UserRef;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploader: UserRef;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: UserRef;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId: string | null;
  productId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ArchRefProduct extends ProductRef {
  status: ProductStatus;
  progress: number;
  taskCount: number;
  overdueCount: number;
}

export interface ArchFeatureRef {
  id: string;
  name: string;
  progress: number;
}

export interface ArchNode {
  id: string;
  kind: NodeKind;
  label: string;
  refProductId: string | null;
  featureId: string | null;
  refProduct: ArchRefProduct | null;
  feature: ArchFeatureRef | null;
  position: { x: number; y: number };
  width: number | null;
  height: number | null;
  isCenter: boolean;
  color: string | null;
}

export interface ArchConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string;
  direction: EdgeDirection;
}

export interface ArchitectureDiagram {
  productId: string;
  updatedAt: string | null;
  nodes: ArchNode[];
  connections: ArchConnection[];
}

export interface ArchNodeInput {
  id: string;
  kind: NodeKind;
  label: string;
  refProductId: string | null;
  featureId: string | null;
  position: { x: number; y: number };
  width: number | null;
  height: number | null;
  isCenter: boolean;
  color: string | null;
}

export interface ArchConnectionInput {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string;
  direction: EdgeDirection;
}

export interface ArchitectureSavePayload {
  baseUpdatedAt: string | null;
  nodes: ArchNodeInput[];
  connections: ArchConnectionInput[];
}

export interface DashboardTotals {
  products: number;
  features: number;
  tasks: number;
  todo: number;
  inProgress: number;
  review: number;
  completed: number;
  overdue: number;
}

export interface DashboardData {
  totals: DashboardTotals;
  statusDistribution: { status: EffectiveTaskStatus; count: number }[];
  completionTrend: { weekStart: string; created: number; completed: number; completedLate: number }[];
  productProgress: { productId: string; name: string; color: string; progress: number; taskCount: number; overdueCount: number }[];
  products: ProductSummary[];
}

export interface ReportsData {
  range: { from: string | null; to: string | null };
  summary: {
    total: number;
    completed: number;
    open: number;
    overdue: number;
    completedLate: number;
    completedOnTime: number;
    onTimeRate: number | null;
  };
  throughput: { period: string; completed: number; completedLate: number }[];
  products: { productId: string; name: string; total: number; completed: number; overdue: number; progress: number }[];
  features: {
    featureId: string;
    name: string;
    category: string;
    productId: string;
    productName: string;
    total: number;
    completed: number;
    overdue: number;
    progress: number;
  }[];
  workload: {
    userId: string | null;
    name: string;
    total: number;
    open: number;
    completed: number;
    overdue: number;
    completedLate: number;
  }[];
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorShape {
  statusCode: number;
  message: string;
  errors?: FieldError[];
}

export interface TasksQuery {
  productId?: string;
  featureId?: string;
  assigneeId?: string;
  creatorId?: string;
  status?: string;
  priority?: string;
  overdue?: boolean;
  from?: string;
  to?: string;
  search?: string;
  sort?: "deadline" | "priority" | "createdAt" | "updatedAt" | "title" | "sortOrder";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface TasksResponse {
  items: Task[];
  total: number;
}
