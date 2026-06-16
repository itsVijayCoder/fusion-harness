export type JudgeResult = {
  consensus: string[];
  contradictions: Array<{
    topic: string;
    models: string[];
    details: string;
    recommended_resolution: string;
  }>;
  missing_coverage: string[];
  unique_insights: Array<{ model: string; insight: string }>;
  risks: Array<{ risk: string; severity: "low" | "medium" | "high"; mitigation: string }>;
  confidence: number;
  recommended_final_strategy: string;
};

export function createEmptyJudgeResult(reason: string): JudgeResult {
  return {
    consensus: [],
    contradictions: [],
    missing_coverage: [reason],
    unique_insights: [],
    risks: [
      {
        risk: reason,
        severity: "medium",
        mitigation: "Use available panel outputs conservatively and call out the missing judge coverage.",
      },
    ],
    confidence: 0,
    recommended_final_strategy: "Proceed conservatively and disclose that judge analysis was incomplete.",
  };
}

export function parseJudgeResult(value: string): JudgeResult {
  try {
    return normalizeJudgeResult(JSON.parse(value) as Partial<JudgeResult>);
  } catch {
    return createEmptyJudgeResult("Judge output was not valid JSON.");
  }
}

export function normalizeJudgeResult(value: Partial<JudgeResult>): JudgeResult {
  return {
    consensus: toStringArray(value.consensus),
    contradictions: Array.isArray(value.contradictions)
      ? value.contradictions.map((contradiction) => ({
          topic: String(contradiction.topic ?? ""),
          models: toStringArray(contradiction.models),
          details: String(contradiction.details ?? ""),
          recommended_resolution: String(contradiction.recommended_resolution ?? ""),
        }))
      : [],
    missing_coverage: toStringArray(value.missing_coverage),
    unique_insights: Array.isArray(value.unique_insights)
      ? value.unique_insights.map((insight) => ({
          model: String(insight.model ?? ""),
          insight: String(insight.insight ?? ""),
        }))
      : [],
    risks: Array.isArray(value.risks)
      ? value.risks.map((risk) => ({
          risk: String(risk.risk ?? ""),
          severity: risk.severity === "high" || risk.severity === "medium" || risk.severity === "low" ? risk.severity : "medium",
          mitigation: String(risk.mitigation ?? ""),
        }))
      : [],
    confidence: clampConfidence(value.confidence),
    recommended_final_strategy: String(value.recommended_final_strategy ?? "Use the strongest supported answer from the panel outputs."),
  };
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function clampConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
