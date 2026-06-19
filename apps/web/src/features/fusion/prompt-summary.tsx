type PromptSummaryProps = {
  prompt: string;
  mode: string;
  timestamp: string;
};

export function PromptSummary({ prompt, mode, timestamp }: PromptSummaryProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-muted-foreground">Prompt</span>
        <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
          {mode}
        </span>
        <span className="text-[11px] text-muted-foreground">{timestamp}</span>
      </div>
      <p className="mt-2 text-[14px] leading-6 text-foreground">{prompt}</p>
    </div>
  );
}