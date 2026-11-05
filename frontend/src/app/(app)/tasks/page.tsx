import { PageHeader } from "@/components/page-header";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";

export default function AllTasksPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="All tasks" description="Every task across all products." />
      <TasksWorkspace />
    </div>
  );
}
