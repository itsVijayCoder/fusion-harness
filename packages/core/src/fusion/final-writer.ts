import type { JudgeResult } from "./judge";
import { buildFinalWriterPrompt } from "./prompt-builder";

export function summarizeFinalStrategy(judge: JudgeResult) {
  return judge.recommended_final_strategy;
}

export type FinalWriterInput = {
  userPrompt: string;
  judge: JudgeResult;
  panelOutputs: Array<{ model: string; output: string }>;
  evidence?: string[];
};

export function buildFinalSynthesisPrompt(input: FinalWriterInput) {
  const evidence = input.evidence?.length
    ? ["", "Tool execution evidence:", ...input.evidence.map((item) => `- ${item}`)].join("\n")
    : "";

  return `${buildFinalWriterPrompt(input.userPrompt, input.judge, input.panelOutputs)}${evidence}`;
}
