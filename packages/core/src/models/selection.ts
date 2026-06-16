import type { AdapterId, FusionProviderPolicy, ModelRef } from "@fusion-harness/shared";

export type ModelSelectionInput = {
  availableModels: ModelRef[];
  preset: string;
  requestedModels?: string[];
  providerPolicy?: FusionProviderPolicy;
  maxPanelModels: number;
};

export type SelectedFusionModels = {
  panel: ModelRef[];
  judge?: ModelRef;
  final?: ModelRef;
};

export function selectFusionModels(input: ModelSelectionInput): SelectedFusionModels {
  const preset = resolvePreset(input.preset);
  const maxPanelModels = Math.max(1, Math.min(input.maxPanelModels || preset.maxPanelModels, preset.maxPanelModels));
  const availableModels = filterByPreset(input.availableModels, preset.adapters);

  if (input.requestedModels?.length) {
    return buildSelection(selectManual(availableModels, input.requestedModels), maxPanelModels);
  }

  const usableModels = availableModels.filter(isUsable);
  const providerPolicy = input.providerPolicy ?? preset.providerPolicy;

  if (providerPolicy === "same_provider_first") {
    const sameProvider = pickBestProviderGroup(usableModels, maxPanelModels);
    if (sameProvider.length >= 2) {
      return buildSelection(sameProvider, maxPanelModels);
    }
  }

  return buildSelection(selectMixedQuality(usableModels, maxPanelModels), maxPanelModels);
}

function isUsable(model: ModelRef) {
  return model.availability !== "unavailable" && model.authMode !== "unknown";
}

function selectManual(models: ModelRef[], requestedModels: string[]) {
  return requestedModels.flatMap((requestedModel) => {
    const match = models.find(
      (model) =>
        model.id === requestedModel ||
        model.model === requestedModel ||
        `${model.adapter}/${model.model}` === requestedModel ||
        `${model.provider}/${model.model}` === requestedModel,
    );
    return match && isUsable(match) ? [match] : [];
  });
}

function pickBestProviderGroup(models: ModelRef[], limit: number) {
  const groups = new Map<string, ModelRef[]>();

  for (const model of models) {
    const providerKey = model.provider ?? model.adapter;
    groups.set(providerKey, [...(groups.get(providerKey) ?? []), model]);
  }

  return [...groups.values()]
    .map((group) => selectMixedQuality(group, limit))
    .sort((a, b) => groupScore(b) - groupScore(a))[0] ?? [];
}

function selectMixedQuality(models: ModelRef[], limit: number) {
  return [...models].sort((a, b) => scoreModel(b) - scoreModel(a)).slice(0, limit);
}

function buildSelection(models: ModelRef[], limit: number): SelectedFusionModels {
  const panel = models.slice(0, Math.max(1, limit));
  const judge = pickJudge(panel);
  const final = pickFinal(panel);

  return {
    panel,
    judge,
    final,
  };
}

function scoreModel(model: ModelRef) {
  const availabilityBonus = model.availability === "verified" ? 4 : model.availability === "listed" ? 2 : 1;
  const authBonus = model.authMode === "cli_session" || model.authMode === "cloud_gateway" ? 2 : model.authMode === "api_key" ? 1 : 0;
  const toolCapabilityBonus = (model.capabilities.tools ? 1 : 0) + (model.capabilities.fileEdits ? 1 : 0) + (model.capabilities.shell ? 1 : 0);
  const structuredOutputBonus = model.capabilities.jsonOutput ? 0.75 : 0;
  const streamingBonus = model.capabilities.streaming ? 0.25 : 0;

  return availabilityBonus + authBonus + toolCapabilityBonus + structuredOutputBonus + streamingBonus;
}

function groupScore(models: ModelRef[]) {
  return models.reduce((score, model) => score + scoreModel(model), 0) + Math.min(models.length, 4);
}

function pickJudge(panel: ModelRef[]) {
  return [...panel].sort((a, b) => Number(b.capabilities.jsonOutput) - Number(a.capabilities.jsonOutput) || scoreModel(b) - scoreModel(a))[0];
}

function pickFinal(panel: ModelRef[]) {
  return [...panel].sort(
    (a, b) =>
      Number(b.capabilities.fileEdits || b.capabilities.tools) - Number(a.capabilities.fileEdits || a.capabilities.tools) ||
      scoreModel(b) - scoreModel(a),
  )[0];
}

function filterByPreset(models: ModelRef[], adapters?: AdapterId[]) {
  if (!adapters?.length) return models;
  const allowed = new Set(adapters);
  return models.filter((model) => allowed.has(model.adapter));
}

function resolvePreset(preset: string): { maxPanelModels: number; providerPolicy: FusionProviderPolicy; adapters?: AdapterId[] } {
  switch (preset) {
    case "opencode-quality":
      return { maxPanelModels: 4, providerPolicy: "same_provider_first", adapters: ["opencode"] };
    case "codex-quality":
      return { maxPanelModels: 4, providerPolicy: "same_provider_first", adapters: ["codex"] };
    case "mixed-coding":
      return { maxPanelModels: 6, providerPolicy: "mixed_quality", adapters: ["opencode", "codex"] };
    case "fast":
    case "budget":
      return { maxPanelModels: 2, providerPolicy: "mixed_quality" };
    case "same-provider-first":
    default:
      return { maxPanelModels: 5, providerPolicy: "same_provider_first" };
  }
}
