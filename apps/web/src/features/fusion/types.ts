import type { ModelRef } from "@fusion-harness/shared";

export type FusionMode = "quality" | "budget" | "custom";

export type ModelOption = {
  id: string;
  name: string;
  provider: string;
  adapter: string;
  available: boolean;
};

export type FusionChat = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

export type ModelResponse = {
  modelId: string;
  modelName: string;
  content: string;
  status: "loading" | "complete" | "error";
};

export type ViewState = "composer" | "results" | "comparison";

export function toModelOption(model: ModelRef): ModelOption {
  return {
    id: model.id,
    name: model.displayName ?? model.model,
    provider: model.provider ?? model.adapter,
    adapter: model.adapter,
    available: model.availability !== "unavailable",
  };
}