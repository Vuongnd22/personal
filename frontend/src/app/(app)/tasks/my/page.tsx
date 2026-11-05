import { PageHeader } from "@/components/page-header";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";

export default function MyTasksPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="My tasks" description="Tasks assigned to you." />
      <TasksWorkspace scope="my" />
    </div>
  );
}
