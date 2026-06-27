"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  RiCheckLine,
  RiCloseLine,
  RiExpandLeftRightLine,
  RiTerminalLine,
} from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { ProviderLogo, providerLabel } from "@/components/provider-logo";
import { cn } from "@/lib/utils";

export type TerminalPanel = {
  jobId: string;
  modelId: string;
  adapter?: string;
  role?: string;
  status: "queued" | "running" | "completed" | "failed";
  terminal?: string;
  error?: string;
  latencyMs?: number;
  queuePosition?: number;
};

export function TerminalGrid({ panels }: { panels: TerminalPanel[] }) {
  const termPanels = panels.filter(
    (p) => p.terminal || p.status === "running" || p.status === "queued",
  );
  if (termPanels.length === 0) return null;

  const running = termPanels.filter((p) => p.status === "running").length;
  const completed = termPanels.filter((p) => p.status === "completed").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <RiTerminalLine aria-hidden className="size-3.5" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">Live Terminals</h2>
        <span className="text-xs text-muted-foreground">
          {termPanels.length} session{termPanels.length !== 1 ? "s" : ""}
          {running > 0 ? ` · ${running} running` : null}
          {completed > 0 ? ` · ${completed} done` : null}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {termPanels.map((panel) => (
          <TerminalCard key={panel.jobId} panel={panel} />
        ))}
      </div>
    </div>
  );
}

function TerminalCard({ panel }: { panel: TerminalPanel }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const writtenRef = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const [hasOutput, setHasOutput] = useState(Boolean(panel.terminal));

  const isRunning = panel.status === "running";
  const isQueued = panel.status === "queued";
  const isCompleted = panel.status === "completed";
  const isFailed = panel.status === "failed";

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      scrollback: 5000,
      disableStdin: true,
      allowProposedApi: true,
      convertEol: true,
      theme: {
        background: "#0c0c0f",
        foreground: "#e4e4e7",
        cursor: "#67e8f9",
        selectionBackground: "rgba(103, 232, 249, 0.2)",
        black: "#0c0c0f",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#67e8f9",
        white: "#e4e4e7",
        brightBlack: "#52525b",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde047",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#a5f3fc",
        brightWhite: "#fafafa",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    try {
      fit.fit();
    } catch {
      // container may have 0 dimensions during initial layout
    }

    termRef.current = term;
    fitRef.current = fit;

    if (panel.terminal) {
      term.write(panel.terminal);
      writtenRef.current = panel.terminal.length;
    }

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // ignore fit errors during transitions
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      writtenRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !panel.terminal) return;
    if (panel.terminal.length > writtenRef.current) {
      term.write(panel.terminal.slice(writtenRef.current));
      writtenRef.current = panel.terminal.length;
      setHasOutput(true);
    }
  }, [panel.terminal]);

  useEffect(() => {
    const fit = fitRef.current;
    if (!fit) return;
    const timer = setTimeout(() => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [expanded]);

  const adapterLabel = panel.adapter ? providerLabel(panel.adapter) : "agent";
  const charCount = panel.terminal?.length ?? 0;
  const charLabel =
    charCount > 999 ? `${(charCount / 1000).toFixed(1)}k chars` : charCount > 0 ? `${charCount} chars` : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card transition-all duration-200",
        "animate-[terminal-card-enter_0.3s_ease-out]",
        isRunning && "border-primary/40 shadow-sm",
        isCompleted && "border-emerald-500/30",
        isFailed && "border-destructive/40",
        isQueued && "border-border",
      )}
    >
      {isRunning ? (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <div className="h-full w-full animate-[terminal-sweep_2s_linear_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>
      ) : null}

      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-border px-3 py-2.5",
          isRunning && "bg-gradient-to-r from-primary/5 to-transparent",
          !isRunning && "bg-muted/50",
        )}
      >
        <ProviderLogo id={panel.adapter ?? panel.modelId} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{panel.modelId}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {adapterLabel}
            {panel.role ? ` · ${panel.role}` : null}
          </p>
        </div>
        <TerminalStatusPill status={panel.status} />
      </div>

      <div
        className="relative bg-[#0c0c0f] transition-[height] duration-300 ease-out"
        style={{ height: expanded ? 420 : 180 }}
      >
        <div ref={containerRef} className="h-full w-full overflow-hidden p-2" />
        {!hasOutput ? <TerminalShimmer queued={isQueued} /> : null}
      </div>

      {isFailed && panel.error ? (
        <div className="border-t border-destructive/20 bg-destructive/5 px-3 py-1.5">
          <p className="truncate text-[11px] text-destructive">{panel.error}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-border bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          {panel.role ? <span className="font-medium">{panel.role}</span> : null}
          {panel.latencyMs ? <span>{panel.latencyMs}ms</span> : null}
          {charLabel ? <span>{charLabel}</span> : null}
          {isQueued && typeof panel.queuePosition === "number" && panel.queuePosition > 0 ? (
            <span>position {panel.queuePosition + 1}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Collapse" : "Expand"}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RiExpandLeftRightLine aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function TerminalStatusPill({ status }: { status: TerminalPanel["status"] }) {
  const isRunning = status === "running";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        isRunning && "bg-primary/15 text-primary",
        isCompleted && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        isFailed && "bg-destructive/15 text-destructive",
        !isRunning && !isCompleted && !isFailed && "bg-muted text-muted-foreground",
      )}
    >
      {isRunning ? (
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
      ) : isCompleted ? (
        <RiCheckLine aria-hidden className="size-3" />
      ) : isFailed ? (
        <RiCloseLine aria-hidden className="size-3" />
      ) : (
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
      )}
      {status}
    </span>
  );
}

function TerminalShimmer({ queued }: { queued: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-2">
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-600 [animation-delay:0ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-600 [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-600 [animation-delay:300ms]" />
      </div>
      <span className="ml-1 text-xs font-medium text-zinc-500">
        {queued ? "Waiting in queue..." : "Waiting for output..."}
      </span>
    </div>
  );
}