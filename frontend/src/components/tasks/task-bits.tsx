import { AlertTriangle, Clock } from "lucide-react";
import { PRIORITY_META, STATUS_META } from "@/lib/format";
import type { EffectiveTaskStatus, Task, TaskPriority } from "@/lib/types";
import { Badge } from "@/components/ui/display";

export function StatusBadge({ status }: { status: EffectiveTaskStatus }) {
  const m = STATUS_META[status];
  return (
    <Badge color={m.color} data-testid="status-badge">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: m.color }} />
      {m.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const m = PRIORITY_META[priority];
  return <Badge color={m.color}>{m.label}</Badge>;
}

/** Overdue / completed-late markers shown next to a task. */
export function TaskFlags({ task }: { task: Pick<Task, "isOverdue" | "completedLate" | "status"> }) {
  return (
    <>
      {task.isOverdue && (
        <Badge color="#dc2626" data-testid="overdue-flag">
          <AlertTriangle className="size-3" /> Overdue
        </Badge>
      )}
      {task.status === "COMPLETED" && task.completedLate && (
        <Badge color="#ea580c" data-testid="late-flag">
          <Clock className="size-3" /> Completed late
        </Badge>
      )}
    </>
  );
}
