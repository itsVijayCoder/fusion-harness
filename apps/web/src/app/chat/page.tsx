import { PageHeader } from "@/components/product-ui";
import { TaskConsole } from "./task-console";

export default function ChatPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Task Console" description="Create direct or fused runs with explicit model policy and permission profile." />
      <TaskConsole />
    </div>
  );
}
