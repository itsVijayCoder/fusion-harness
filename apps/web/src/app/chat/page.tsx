import type { ModelRef, RunnerRef } from "@fusion-harness/shared";
import { apiGet } from "@/lib/api";
import { TaskConsole } from "./task-console";

export const dynamic = "force-dynamic";

type ModelResponse = {
  aliases: Array<{ id: string; owned_by: string }>;
  data: ModelRef[];
};

type RunnerResponse = { data: RunnerRef[] };

export default async function ChatPage() {
  const [models, runners] = await Promise.all([
    apiGet<ModelResponse>("/api/models", { aliases: [], data: [] }),
    apiGet<RunnerResponse>("/api/runners", { data: [] }),
  ]);

  return <TaskConsole models={models.data.data} runners={runners.data.data} />;
}
