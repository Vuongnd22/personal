import { PageHeader } from "@/components/page-header";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";

export default function OverdueTasksPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="Overdue tasks" description="Open tasks whose deadline has passed. They leave this list as soon as they are completed or the deadline moves." />
      <TasksWorkspace scope="overdue" />
    </div>
  );
}
