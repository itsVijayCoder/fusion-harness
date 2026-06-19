import { AlertTriangle, RotateCcw, Shuffle } from "lucide-react";

type ErrorCardProps = {
  onRetry: () => void;
  onTryDifferent: () => void;
};

export function ErrorCard({ onRetry, onTryDifferent }: ErrorCardProps) {
  return (
    <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-destructive/20">
          <AlertTriangle aria-hidden className="size-3 text-destructive" />
        </span>
        <div className="flex-1">
          <p className="text-[13px] font-medium text-destructive">
            Fusion failed. You can retry from the results view.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[12px] font-medium text-destructive transition-colors duration-150 hover:bg-destructive/20"
            >
              <RotateCcw aria-hidden className="size-3" />
              Try again
            </button>
            <button
              onClick={onTryDifferent}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[12px] font-medium text-destructive transition-colors duration-150 hover:bg-destructive/20"
            >
              <Shuffle aria-hidden className="size-3" />
              Try with different models
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}