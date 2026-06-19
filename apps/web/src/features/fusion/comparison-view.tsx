import { X } from "lucide-react";
import type { ModelOption, ModelResponse } from "./types";

type ComparisonViewProps = {
  models: ModelOption[];
  responses: ModelResponse[];
  onClose: () => void;
}

export function ComparisonView({ models, responses, onClose }: ComparisonViewProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[13px] font-medium text-foreground">All Model Responses</span>
        <button
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-hidden p-3">
        {models.map((model) => {
          const response = responses.find((r) => r.modelId === model.id);
          return (
            <div
              key={model.id}
              className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-secondary"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <span className="text-[13px] font-medium text-foreground">{model.name}</span>
                <button className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">
                  <X aria-hidden className="size-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {response?.content ? (
                  <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-foreground">
                    {response.content}
                  </pre>
                ) : (
                  <p className="text-[13px] text-muted-foreground">No response yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}