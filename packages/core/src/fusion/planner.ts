import type { FusionRunRequest } from "@fusion-harness/shared";

const fusionTriggers = [
  "architecture",
  "architectural",
  "security",
  "threat model",
  "migration",
  "database",
  "schema",
  "high risk",
  "ambiguous",
  "tradeoff",
  "review",
  "refactor",
  "production",
  "permission",
  "sandbox",
  "multi-model",
] as const;

export function shouldUseFusion(request: FusionRunRequest) {
  if (request.mode === "required") return true;
  if (request.mode === "direct") return false;

  const prompt = request.messages.map((message) => message.content).join("\n").toLowerCase();
  return fusionTriggers.some((trigger) => prompt.includes(trigger));
}

export function classifyFusionNeed(request: FusionRunRequest) {
  if (request.mode === "required") return { useFusion: true, reason: "mode_required" };
  if (request.mode === "direct") return { useFusion: false, reason: "mode_direct" };

  const prompt = request.messages.map((message) => message.content).join("\n").toLowerCase();
  const trigger = fusionTriggers.find((candidate) => prompt.includes(candidate));

  return {
    useFusion: Boolean(trigger),
    reason: trigger ? `trigger:${trigger}` : "auto_no_trigger",
  };
}
