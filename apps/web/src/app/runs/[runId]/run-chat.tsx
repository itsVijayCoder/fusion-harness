"use client";

import { extractReadableOutput, type FusionRunDetail, type RunEvent, type RunStatus } from "@fusion-harness/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RiArrowRightLine,
  RiArrowUpLine,
  RiErrorWarningLine,
  RiFileList3Line,
  RiHistoryLine,
  RiLayoutGridLine,
  RiRobot2Line,
  RiUserLine,
} from "@remixicon/react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { OutputDrawer } from "@/components/output-drawer";
import { StatusPill } from "@/components/product-ui";
import { TopNav } from "@/features/fusion/top-nav";
import { apiPost, apiUrl } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";

type RunChatProps = {
  run: FusionRunDetail;
};

type PanelTrace = {
  jobId: string;
  modelId: string;
  adapter?: string;
  role?: string;
  status: "queued" | "running" | "completed" | "failed";
  text: string;
  error?: string;
};

type PhaseTrace = {
  status: "queued" | "running" | "completed" | "failed";
  text: string;
  error?: string;
};

type Trace = {
  panels: PanelTrace[];
  synthesis: PhaseTrace;
  final: PhaseTrace;
  runStatus: RunStatus;
};

type DrawerState = {
  title: string;
  subtitle?: string;
  status?: string;
  content: string;
  error?: string;
} | null;

export function RunChat({ run }: RunChatProps) {
  const router = useRouter();
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting" | "closed">("connecting");
  const [showDetails, setShowDetails] = useState(false);
  const [continueMessage, setContinueMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const initialStatus = run.status;
  const messages = useMemo(() => run.messages ?? [], [run.messages]);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let isActive = true;

    async function loadSnapshot() {
      const response = await fetch(apiUrl(`/api/fusion/runs/${run.id}/events`), { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json().catch(() => ({}))) as { data?: RunEvent[] };
      if (isActive && Array.isArray(body.data)) {
        setEvents((current) => mergeEvents(current, body.data ?? []));
      }
    }

    function connect() {
      setConnection((current) => (current === "closed" ? "reconnecting" : current));
      socket = new WebSocket(toWebSocketUrl(apiUrl(`/api/fusion/runs/${run.id}/events`)));
      socket.addEventListener("open", () => {
        if (isActive) setConnection("live");
      });
      socket.addEventListener("message", (message) => {
        const parsed = parseSocketMessage(message.data);
        if (!parsed) return;
        setEvents((current) => mergeEvents(current, parsed));
      });
      socket.addEventListener("close", () => {
        if (!isActive) return;
        setConnection("closed");
        window.setTimeout(() => {
          if (isActive) connect();
        }, 2000);
      });
      socket.addEventListener("error", () => {
        if (isActive) setConnection("reconnecting");
      });
    }

    void loadSnapshot();
    connect();

    return () => {
      isActive = false;
      socket?.close();
    };
  }, [run.id]);

  const trace = useMemo(() => buildTrace(events, initialStatus), [events, initialStatus]);
  const finalText = trace.final.text || extractFinalOutput(trace.synthesis.text);
  const judgeText = extractJudgeAnalysisText(trace.synthesis.text);
  const currentStatus = trace.runStatus;
  const isRunActive = currentStatus === "queued" || currentStatus === "running" || currentStatus === "waiting_approval";
  const showLiveOutput = finalText.trim().length > 0 || trace.final.status === "running";
  const showThinking = isRunActive && !showLiveOutput;
  const hasPanelOutputs = trace.panels.some((p) => p.text.trim().length > 0 || p.status === "running");
  const hasJudgeOutput = judgeText.trim().length > 0 || trace.synthesis.status === "running";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, finalText, showThinking, trace.panels.length]);

  async function handleContinue() {
    const message = continueMessage.trim();
    if (!message || isSending || isRunActive) return;

    setIsSending(true);
    setSendError(undefined);
    try {
      const result = await apiPost<{ id: string }>(`/api/fusion/runs/${run.id}/continue`, { message });
      router.push(`/runs/${result.id}`);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to continue conversation");
      setIsSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleContinue();
    }
  }

  function openPanelDrawer(panel: PanelTrace) {
    setDrawer({
      title: panel.modelId,
      subtitle: [panel.adapter, panel.role].filter(Boolean).join(" · ") || "panel",
      status: panel.status,
      content: panel.text,
      error: panel.error,
    });
  }

  function openJudgeDrawer() {
    setDrawer({
      title: "Judge / Synthesis",
      subtitle: "Analysis from the final-output model",
      status: trace.synthesis.status,
      content: judgeText,
      error: trace.synthesis.error,
    });
  }

  function openFinalDrawer() {
    setDrawer({
      title: "Final Output",
      subtitle: "Fused result",
      status: trace.final.status,
      content: finalText,
      error: trace.final.error || trace.synthesis.error,
    });
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <TopNav />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="truncate text-sm font-medium text-foreground">{run.title ?? run.id}</span>
          <StatusPill value={currentStatus} />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {run.mode} · {formatDateTime(run.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "hidden h-6 items-center rounded-md border px-2 text-xs font-medium sm:inline-flex",
              connection === "live"
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            {connection}
          </span>
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RiLayoutGridLine aria-hidden className="size-4" />
            <span className="hidden sm:inline">Details</span>
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.length > 0 ? (
            messages.map((message, index) => (
              <MessageBubble key={index} role={message.role} content={message.content} />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">Initial prompt not available for this run.</p>
            </div>
          )}

          {showThinking ? <ThinkingIndicator trace={trace} /> : null}

          {(hasPanelOutputs || hasJudgeOutput || !isRunActive) && !showThinking ? (
            <OutputAccordions
              trace={trace}
              finalText={finalText}
              judgeText={judgeText}
              onOpenPanel={openPanelDrawer}
              onOpenJudge={openJudgeDrawer}
              onOpenFinal={openFinalDrawer}
            />
          ) : null}

          {!isRunActive && !showLiveOutput && currentStatus === "failed" ? (
            <MessageBubble
              role="assistant"
              content=""
              error={run.error || "Run failed without producing output."}
            />
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {sendError ? <p className="mb-2 text-sm text-destructive">{sendError}</p> : null}
          <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2">
            <textarea
              value={continueMessage}
              onChange={(event) => setContinueMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunActive || isSending}
              placeholder={isRunActive ? "Waiting for run to complete..." : "Continue the conversation..."}
              rows={1}
              className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={isRunActive || isSending || !continueMessage.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RiArrowUpLine aria-hidden className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 px-2 text-xs text-muted-foreground">
            {isRunActive
              ? "Continue will be available once the run completes."
              : "Press Enter to send, Shift+Enter for new line."}
          </p>
        </div>
      </div>

      {drawer ? (
        <OutputDrawer
          title={drawer.title}
          subtitle={drawer.subtitle}
          status={drawer.status}
          content={drawer.content}
          error={drawer.error}
          onClose={() => setDrawer(null)}
        />
      ) : null}

      {showDetails ? (
        <DetailsPanel
          run={run}
          onClose={() => setShowDetails(false)}
        />
      ) : null}
    </div>
  );
}

function MessageBubble({
  role,
  content,
  error,
  isStreaming,
  onOpenFull,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  error?: string;
  isStreaming?: boolean;
  onOpenFull?: () => void;
}) {
  const isUser = role === "user";
  const isSystem = role === "system";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <RiUserLine aria-hidden className="size-4" /> : <RiRobot2Line aria-hidden className="size-4" />}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-[calc(100%-3rem)] rounded-2xl px-4 py-3 text-sm leading-6",
          isUser
            ? "rounded-tr-md bg-primary text-primary-foreground"
            : isSystem
              ? "rounded-tl-md bg-muted/50 text-muted-foreground italic"
              : "rounded-tl-md bg-muted text-foreground",
        )}
      >
        {error ? (
          <p className="break-words text-destructive [overflow-wrap:anywhere]">{error}</p>
        ) : content ? (
          <>
            <div className="break-words [overflow-wrap:anywhere]">
              {isUser ? (
                <div className="whitespace-pre-wrap">{content}</div>
              ) : (
                <MarkdownRenderer content={content} />
              )}
              {isStreaming ? (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />
              ) : null}
            </div>
            {onOpenFull && !isStreaming ? (
              <button
                onClick={onOpenFull}
                className="mt-2 text-xs font-medium text-primary hover:text-primary/80"
              >
                View full output
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function ThinkingIndicator({ trace }: { trace: Trace }) {
  const phase = currentPhaseLabel(trace);
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <RiRobot2Line aria-hidden className="size-4" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted px-4 py-3">
        <div className="flex gap-1">
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
        </div>
        <span className="text-sm text-muted-foreground">{phase}</span>
      </div>
    </div>
  );
}

function currentPhaseLabel(trace: Trace): string {
  if (trace.panels.some((panel) => panel.status === "running")) {
    const completed = trace.panels.filter((panel) => panel.status === "completed").length;
    return `Panel phase (${completed}/${trace.panels.length} complete)`;
  }
  if (trace.synthesis.status === "running") return "Analyzing panel outputs";
  if (trace.final.status === "running") return "Generating response";
  return "Thinking";
}

type OutputAccordionsProps = {
  trace: Trace;
  finalText: string;
  judgeText: string;
  onOpenPanel: (panel: PanelTrace) => void;
  onOpenJudge: () => void;
  onOpenFinal: () => void;
};

function OutputAccordions({
  trace,
  finalText,
  judgeText,
  onOpenPanel,
  onOpenJudge,
  onOpenFinal,
}: OutputAccordionsProps) {
  const panelStep = trace.panels.length > 0;
  const judgeStep = judgeText.trim().length > 0 || trace.synthesis.status !== "queued";
  const finalStep = finalText.trim().length > 0 || trace.final.status !== "queued";

  let stepCount = 0;
  if (panelStep) stepCount++;
  if (judgeStep) stepCount++;
  if (finalStep) stepCount++;

  let currentStep = 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          SOURCES
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          {stepCount > 0 ? `Step 1/${stepCount}` : "Processing"}
        </span>
      </div>

      {panelStep ? (
        <>
          {trace.panels.map((panel) => {
            currentStep++;
            return (
              <SourceRow
                key={panel.jobId}
                step={currentStep}
                title={panel.modelId}
                subtitle={[panel.adapter, panel.role].filter(Boolean).join(" · ") || "panel"}
                status={panel.status}
                onClick={() => onOpenPanel(panel)}
              />
            );
          })}
        </>
      ) : null}

      {judgeStep ? (
        (() => {
          currentStep++;
          return (
            <SourceRow
              step={currentStep}
              title="Judge / Synthesis"
              subtitle="Analysis from the final-output model"
              status={trace.synthesis.status}
              onClick={onOpenJudge}
            />
          );
        })()
      ) : null}

      {finalStep ? (
        (() => {
          currentStep++;
          return (
            <SourceRow
              step={currentStep}
              title="Final Output"
              subtitle="Fused result"
              status={trace.final.status}
              onClick={onOpenFinal}
            />
          );
        })()
      ) : null}
    </div>
  );
}

function SourceRow({
  step,
  title,
  subtitle,
  status,
  onClick,
}: {
  step: number;
  title: string;
  subtitle: string;
  status: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors duration-150 hover:border-foreground/10 hover:bg-muted/30"
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border text-[10px] font-semibold text-muted-foreground">
        {step}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <StatusPill value={status} />
      <RiArrowRightLine aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function DetailsPanel({
  run,
  onClose,
}: {
  run: FusionRunDetail;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-sm font-semibold text-foreground">Run Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RiErrorWarningLine aria-hidden className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-6">
            <DetailSection title="Run Info">
              <DetailGrid
                items={[
                  { label: "Status", value: run.status },
                  { label: "Mode", value: run.mode },
                  { label: "Permission", value: run.permissionProfile },
                  { label: "Preset", value: run.preset ?? "None" },
                  { label: "Created", value: formatDateTime(run.createdAt) },
                  { label: "Started", value: formatDateTime(run.startedAt) },
                  { label: "Completed", value: formatDateTime(run.completedAt) },
                  ...(run.parentRunId ? [{ label: "Parent Run", value: run.parentRunId }] : []),
                  ...(run.conversationId ? [{ label: "Conversation", value: run.conversationId }] : []),
                ]}
              />
              {run.error ? (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  <RiErrorWarningLine aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span className="break-words">{run.error}</span>
                </div>
              ) : null}
            </DetailSection>

            <DetailSection title="Artifacts" icon={RiFileList3Line}>
              {run.artifacts.length ? (
                <div className="flex flex-col gap-2">
                  {run.artifacts.map((artifact) => (
                    <Link
                      key={artifact.id}
                      href={`/artifacts/${artifact.id}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border p-2 hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{artifact.kind}</p>
                        <p className="truncate text-xs text-muted-foreground">{artifact.objectKey}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(artifact.sizeBytes)}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyDetail text="No artifacts yet." />
              )}
            </DetailSection>

            <DetailSection title="Audit History" icon={RiHistoryLine}>
              {run.auditEvents.length ? (
                <div className="flex flex-col gap-2">
                  {run.auditEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{event.eventType}</p>
                        <p className="text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                      </div>
                      <StatusPill value={event.severity} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyDetail text="No audit events." />
              )}
            </DetailSection>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border p-2">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground" title={item.value}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function EmptyDetail({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function buildTrace(events: RunEvent[], initialStatus: RunStatus): Trace {
  const panels = new Map<string, PanelTrace>();
  const synthesis: PhaseTrace = { status: "queued", text: "" };
  const final: PhaseTrace = { status: "queued", text: "" };
  let runStatus: RunStatus | null = null;

  for (const event of events) {
    const jobId = event.jobId ?? "";
    if (event.type === "panel.job.queued" && jobId) {
      panels.set(jobId, {
        jobId,
        modelId: stringData(event, "modelId") || jobId,
        adapter: stringData(event, "adapter"),
        role: stringData(event, "role"),
        status: "queued",
        text: "",
      });
    }
    if (event.type === "panel.job.started" && jobId) {
      const existing = panels.get(jobId);
      panels.set(jobId, { ...fallbackPanel(event), ...existing, status: "running" });
    }
    if (event.type === "panel.output.delta" && jobId) {
      const existing = panels.get(jobId) ?? fallbackPanel(event);
      panels.set(jobId, { ...existing, text: existing.text + eventText(event) });
    }
    if (event.type === "panel.job.completed" && jobId) {
      const existing = panels.get(jobId) ?? fallbackPanel(event);
      panels.set(jobId, { ...existing, status: "completed", text: existing.text || eventText(event) });
    }
    if (event.type === "panel.job.failed" && jobId) {
      const existing = panels.get(jobId) ?? fallbackPanel(event);
      panels.set(jobId, { ...existing, status: "failed", error: stringData(event, "error") });
    }
    if (event.type === "judge.started") {
      synthesis.status = "running";
    }
    if (event.type === "judge.output.delta") {
      synthesis.status = "running";
      synthesis.text = appendText(synthesis.text, eventText(event));
    }
    if (event.type === "judge.completed") {
      synthesis.status = "completed";
      synthesis.text = synthesis.text || eventText(event);
    }
    if (event.type === "judge.failed") {
      synthesis.status = "failed";
      synthesis.error = stringData(event, "error");
      synthesis.text = synthesis.text || eventText(event);
    }
    if (event.type === "final.started") {
      final.status = "running";
    }
    if (event.type === "final.delta") {
      final.status = "running";
      final.text = appendText(final.text, eventText(event));
    }
    if (event.type === "final.completed") {
      final.status = "completed";
      final.text = final.text || eventText(event);
    }
    if (event.type === "run.started") {
      runStatus = "running";
    }
    if (event.type === "run.completed") {
      runStatus = "completed";
    }
    if (event.type === "run.failed") {
      runStatus = "failed";
      final.status = final.text ? final.status : "failed";
      final.error = stringData(event, "error") || final.error;
    }
    if (event.type === "run.cancelled") {
      runStatus = "cancelled";
    }
  }

  return {
    panels: [...panels.values()],
    synthesis,
    final,
    runStatus: runStatus ?? initialStatus,
  };
}

function fallbackPanel(event: RunEvent): PanelTrace {
  return {
    jobId: event.jobId ?? "panel",
    modelId: stringData(event, "modelId") || event.jobId || "panel",
    adapter: stringData(event, "adapter"),
    role: stringData(event, "role"),
    status: "queued",
    text: "",
  };
}

function eventText(event: RunEvent) {
  return extractReadableOutput(stringData(event, "text") || stringData(event, "outputText"));
}

function stringData(event: RunEvent, key: string) {
  const value = event.data[key];
  return typeof value === "string" ? value : "";
}

function mergeEvents(current: RunEvent[], incoming: RunEvent[]) {
  const eventsBySeq = new Map<number, RunEvent>();
  for (const event of current) eventsBySeq.set(event.seq, event);
  for (const event of incoming) eventsBySeq.set(event.seq, event);
  return [...eventsBySeq.values()].sort((a, b) => a.seq - b.seq);
}

function appendText(current: string, next: string) {
  if (!next) return current;
  return current ? `${current}${next}` : next;
}

function extractFinalOutput(text: string) {
  const marker = "FINAL_OUTPUT:";
  const trimmed = text.trim();
  const markerIndex = trimmed.lastIndexOf(marker);
  if (markerIndex < 0) return trimmed;
  return trimmed.slice(markerIndex + marker.length).trim();
}

function extractJudgeAnalysisText(text: string) {
  const analysisMarker = "JUDGE_ANALYSIS_JSON:";
  const finalMarker = "FINAL_OUTPUT:";
  const trimmed = text.trim();
  const withAnalysis = trimmed.includes(analysisMarker)
    ? trimmed.slice(trimmed.indexOf(analysisMarker) + analysisMarker.length)
    : trimmed;
  const withoutFinal = withAnalysis.includes(finalMarker)
    ? withAnalysis.slice(0, withAnalysis.indexOf(finalMarker))
    : withAnalysis;
  return withoutFinal.trim();
}

function parseSocketMessage(data: string) {
  try {
    const parsed = JSON.parse(data) as RunEvent | { type?: string; data?: RunEvent[] };
    if ("type" in parsed && parsed.type === "snapshot" && Array.isArray(parsed.data)) {
      return parsed.data;
    }
    if ("seq" in parsed && typeof parsed.seq === "number") {
      return [parsed as RunEvent];
    }
  } catch {
    return null;
  }
  return null;
}

function toWebSocketUrl(url: string) {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return parsed.toString();
}