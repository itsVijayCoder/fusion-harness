import { X } from "lucide-react";
import type { ModelResponse } from "./types";

type RightResponseDrawerProps = {
  response: ModelResponse;
  onClose: () => void;
}

export function RightResponseDrawer({ response, onClose }: RightResponseDrawerProps) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-secondary">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-[13px] font-semibold text-foreground">{response.modelName}</span>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-foreground">
            {response.content}
          </pre>
        </div>
      </div>
    </>
  );
}