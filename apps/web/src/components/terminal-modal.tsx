"use client";

import {
  RiCheckLine,
  RiCloseLine,
  RiDownloadLine,
  RiFileList3Line,
  RiTerminalLine,
  RiLightbulbLine,
  RiArrowDownLine,
} from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ModelBadge } from "@/components/model-badge";
import { cn } from "@/lib/utils";

export type TerminalTab = "thinking" | "terminal" | "output";

type TerminalModalProps = {
  modelId: string;
  adapter?: string;
  role?: string;
  status: "queued" | "running" | "completed" | "failed";
  text: string;
  terminal?: string;
  thinking?: string;
  error?: string;
  latencyMs?: number;
  queuePosition?: number;
  onClose: () => void;
};

export function TerminalModal({
  modelId,
  adapter,
  role,
  status,
  text,
  terminal,
  thinking,
  error,
  latencyMs,
  queuePosition,
  onClose,
}: TerminalModalProps) {
  const isRunning = status === "running";
  const isQueued = status === "queued";
  const isFailed = status === "failed";

  const hasThinking = Boolean(thinking?.trim());
  const hasTerminal = Boolean(terminal?.trim());
  const hasOutput = Boolean(text.trim());

  const [tab, setTab] = useState<TerminalTab>(() => {
    if (hasThinking) return "thinking";
    if (hasTerminal) return "terminal";
    if (hasOutput) return "output";
    return "terminal";
  });

  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Esc to close, Cmd/Ctrl+K to copy.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        void handleCopy();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Auto-scroll to bottom when content grows, unless the user scrolled up.
  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [terminal, thinking, text, tab, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  function jumpToLatest() {
    setAutoScroll(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }

  async function handleCopy() {
    const content = tab === "thinking" ? thinking ?? "" : tab === "terminal" ? terminal ?? "" : text;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  function handleDownload() {
    const content = tab === "thinking" ? thinking ?? "" : tab === "terminal" ? terminal ?? "" : text;
    if (!content) return;
    const ext = tab === "terminal" ? "log" : "md";
    const blob = new Blob([content], { type: "text/plain; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modelId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeContent = tab === "thinking" ? thinking ?? "" : tab === "terminal" ? terminal ?? "" : text;
  const charCount = activeContent.length;
  const lineCount = activeContent ? activeContent.split("\n").length : 0;

  const tabs: Array<{ id: TerminalTab; label: string; icon: React.ElementType; available: boolean }> = [
    { id: "thinking", label: "Thinking", icon: RiLightbulbLine, available: hasThinking || isRunning },
    { id: "terminal", label: "Terminal", icon: RiTerminalLine, available: hasTerminal || isRunning || isQueued },
    { id: "output", label: "Output", icon: RiFileList3Line, available: hasOutput },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Live terminal for ${modelId}`}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex h-[min(85vh,760px)] w-[min(960px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
          "animate-[terminal-modal-in_180ms_ease-out]",
          isRunning && "border-primary/40",
          isFailed && "border-destructive/40",
          !isRunning && !isFailed && "border-border",
        )}
      >
        {/* Animated top accent border while running */}
        {isRunning ? (
          <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
            <div className="h-full w-full animate-[terminal-accent_2s_linear_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
          </div>
        ) : null}

        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusDot status={status} />
            <ModelBadge adapter={adapter} modelId={modelId} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{modelId}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {[adapter, role].filter(Boolean).join(" · ") || "panel"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <div className="mx-1 h-5 w-px bg-border" />
            <button
              onClick={handleCopy}
              disabled={!activeContent}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title="Copy (⌘K)"
            >
              {copied ? <RiCheckLine aria-hidden className="size-3.5 text-primary" /> : <RiFileList3Line aria-hidden className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              disabled={!activeContent}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title="Download"
            >
              <RiDownloadLine aria-hidden className="size-3.5" />
            </button>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Close (Esc)"
            >
              <RiCloseLine aria-hidden className="size-4" />
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-3">
          {tabs.map((t) => {
            if (!t.available) return null;
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex h-10 items-center gap-1.5 border-b-2 px-3 text-xs font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-3.5" />
                {t.label}
                {t.id === "terminal" && hasTerminal ? (
                  <span className="text-[10px] text-muted-foreground">{lineCount}L</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto"
        >
          {isQueued && !hasTerminal ? (
            <QueueState adapter={adapter} queuePosition={queuePosition} />
          ) : tab === "terminal" ? (
            <TerminalBody text={terminal ?? ""} isRunning={isRunning} />
          ) : tab === "thinking" ? (
            <ThinkingBody text={thinking ?? ""} isRunning={isRunning} />
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-6">
              {error ? (
                <p className="break-words text-sm text-destructive">{error}</p>
              ) : text ? (
                <MarkdownRenderer content={text} size="lg" />
              ) : (
                <p className="text-sm text-muted-foreground">No output yet.</p>
              )}
            </div>
          )}

          {/* Jump to latest */}
          {!autoScroll && (hasTerminal || hasThinking || hasOutput) ? (
            <button
              onClick={jumpToLatest}
              className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-lg transition-colors hover:bg-muted"
            >
              <RiArrowDownLine aria-hidden className="size-3.5" />
              Jump to latest
            </button>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-border px-5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            {role ? <span>{role}</span> : null}
            <span>{charCount.toLocaleString()} chars</span>
            <span>{lineCount.toLocaleString()} lines</span>
            {latencyMs ? <span>{latencyMs}ms</span> : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Esc to close · ⌘K to copy</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes terminal-modal-in {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        @keyframes terminal-accent {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }
        @keyframes terminal-cursor-blink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "completed") {
    return <span className="size-2 rounded-full bg-primary" />;
  }
  if (status === "failed") {
    return <span className="size-2 rounded-full bg-destructive" />;
  }
  if (status === "running") {
    return <span className="size-2 animate-pulse rounded-full bg-primary shadow-[0_0_8px] shadow-primary/60" />;
  }
  return <span className="size-2 rounded-full bg-muted-foreground" />;
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "running" ? "running" : status === "completed" ? "completed" : status === "failed" ? "failed" : "queued";
  const cls =
    status === "running"
      ? "border-primary/20 bg-primary/10 text-primary"
      : status === "completed"
        ? "border-primary/20 bg-primary/10 text-primary"
        : status === "failed"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}

function TerminalBody({ text, isRunning }: { text: string; isRunning: boolean }) {
  if (!text) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          {isRunning ? "Waiting for process output..." : "No terminal output."}
        </p>
      </div>
    );
  }
  return (
    <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-foreground [overflow-wrap:anywhere]">
      <code className="whitespace-pre-wrap">{text}</code>
      {isRunning ? (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-3.5 w-2 translate-y-0.5 bg-foreground"
          style={{ animation: "terminal-cursor-blink 1s step-end infinite" }}
        />
      ) : null}
    </pre>
  );
}

function ThinkingBody({ text, isRunning }: { text: string; isRunning: boolean }) {
  if (!text) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          {isRunning ? "Thinking..." : "No thinking block."}
        </p>
      </div>
    );
  }
  return (
    <div className="p-5">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        {isRunning ? (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            thinking
          </div>
        ) : null}
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">
          {text}
          {isRunning ? (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-foreground/60"
              style={{ animation: "terminal-cursor-blink 1s step-end infinite" }}
            />
          ) : null}
        </p>
      </div>
    </div>
  );
}

function QueueState({ adapter, queuePosition }: { adapter?: string; queuePosition?: number }) {
  const label = adapter ? `Waiting for ${adapter}…` : "Waiting in queue…";
  const position = typeof queuePosition === "number" && queuePosition > 0 ? `Position ${queuePosition + 1} in queue` : "Queued";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
      <div className="flex gap-1.5">
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        {position} · same-adapter runs are serialized
      </p>
    </div>
  );
}