import type { ModelRef } from "@fusion-harness/shared";
import { FusionApp } from "@/features/fusion/fusion-app";
import { toModelOption } from "@/features/fusion/types";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type ModelResponse = {
  aliases: Array<{ id: string; owned_by: string }>;
  data: ModelRef[];
};

export default async function ChatPage() {
  const models = await apiGet<ModelResponse>("/api/models", { aliases: [], data: [] });
  const options = models.data.data.map(toModelOption);

  return <FusionApp models={options} />;
}