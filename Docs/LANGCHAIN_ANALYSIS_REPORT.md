# LangChain Adoption Analysis — openFusion

**Prepared by:** Senior Fullstack Engineering (System Design: HLD + LLD)
**Date:** 2026-06-25
**Subject:** Does LangChain improve openFusion's multi-model fusion pipeline? Where, why, and how?
**Status:** Decision-support document (not yet an ADR)

---

## 0. TL;DR (Executive Verdict)

| Question | Answer |
|---|---|
| Should openFusion adopt LangChain as its orchestration framework? | **No.** A full-framework adoption is a net negative. |
| Are there narrow LangChain primitives worth importing? | **Yes, selectively.** Structured output, output parsers, and (later) RAG retrievers. |
| What is the single highest-value LangChain primitive to adopt now? | `withStructuredOutput()` / Zod-backed structured output for the **judge** stage. |
| What should we NOT replace? | The `FusionExecutionPlan` + Durable Object + D1 job-queue orchestration. LangChain chains run in-process; openFusion is distributed. |
| Biggest architectural mismatch? | openFusion calls LLMs via **CLI subprocesses** (`opencode run`, `codex exec`), not LLM HTTP APIs. LangChain is built for API calls. |
| Biggest runtime risk? | Cloudflare Workers bundle size + CPU limits. LangChain.JS is heavy and Node-leaning. |

**One-line guidance:** Treat LangChain as a **library of primitives**, not a framework. Import `@langchain/core` output parsers + structured output today; revisit LangGraph when we add agentic (iterative, tool-calling) fusion modes; revisit LangChain retrievers when we add codebase RAG. Do not port the orchestration layer onto LangChain.

---

## 1. Methodology

This report is grounded in a direct read of the openFusion codebase, not generic LangChain marketing. Specifically I analyzed:

- `packages/core/src/fusion/*` — prompt builder, orchestrator, planner, judge parser, analysis, final writer
- `packages/core/src/models/*` — model selection scoring, registry
- `workers/api/src/services/runs.ts` — the real fusion run orchestrator (1301 lines)
- `workers/api/src/routes/openai-compatible.ts` — OpenAI-compatible endpoint
- `workers/api/src/durable-objects/FusionRunDO.ts` — live run state
- `workers/api/src/workflows/FusionWorkflow.ts` — (currently a scaffold)
- `apps/runner-go/internal/fusion/*` — Go runner fusion flow (runner.go, prompts.go, verify.go, analysis.go)
- `packages/shared/src/types.ts` — domain types
- `Docs/FH_PRODUCT_PLAN.md` — product plan and ADRs
- All `package.json` files for dependency audit

The analysis evaluates LangChain against the **actual** code, not the intended code.

---

## 2. Current Architecture Snapshot (As-Built)

### 2.1 High-Level Design (HLD)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUD CONTROL PLANE                          │
│                  (Cloudflare Workers, TypeScript)                │
│                                                                 │
│  Next.js Web ──► Hono API ──► /v1/chat/completions (OpenAI)     │
│                              /api/fusion/runs (native)          │
│                              /mcp (remote MCP)                  │
│                                                                 │
│  FusionRunDO ◄──► D1 (metadata) ──► R2 (artifacts)             │
│  (Durable Object)  KV (config cache)                           │
│                                                                 │
│  packages/core: plan, select models, build prompts, parse judge │
└────────────────────────┬────────────────────────────────────────┘
                         │ runner session channel (WebSocket-ish)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LOCAL EXECUTION PLANE                          │
│                     (Go native binary)                          │
│                                                                 │
│  fusion.Execute() ──► panel (parallel) ──► judge ──► verify     │
│       │                                                          │
│       ├── opencode.Adapter (subprocess: `opencode run`)          │
│       ├── codex.Adapter    (subprocess: `codex exec`)            │
│       ├── host.Executor    (os/exec)                             │
│       └── docker.Executor (sandboxed)                            │
└─────────────────────────────────────────────────────────────────┘
```

**Critical architectural fact:** LLM inference does NOT happen in the Worker. The Worker plans and coordinates; the Go runner executes by spawning CLI subprocesses. The only direct LLM call from the Worker is `env.AI.run("@cf/meta/llama-3.1-8b-instruct")` for run-title generation (`runs.ts:1235`).

### 2.2 Low-Level Design (LLD) — The Fusion Pipeline

The pipeline has two implementations that must stay in sync:

| Stage | TypeScript (`packages/core`) | Go (`apps/runner-go/internal/fusion`) |
|---|---|---|
| Plan | `orchestrator.ts:buildFusionExecutionPlan()` | `runner.go:Execute()` |
| Panel prompt | `prompt-builder.ts:buildPanelPromptWithLens()` | `prompts.go:buildPanelPromptWithLens()` |
| Judge prompt | `prompt-builder.ts:buildJudgeSynthesisPromptV2()` | `prompts.go:buildJudgeSynthesisPromptV2()` |
| Judge parse | `judge.ts:parseJudgeResult()` + `extractSynthesisAnalysis()` | `prompts.go:extractSynthesisAnalysis()` |
| Analysis | `analysis.ts:computeAnalysis()` (n-gram Jaccard) | `analysis.go:computeAnalysis()` |
| Verify | (not in core) | `verify.go:verifyAnswer()` + `buildRefinementPrompt()` |
| Final writer | `final-writer.ts:buildFinalSynthesisPrompt()` | (merged into judge in Go) |

**Drift risk:** prompt strings and parsing markers are duplicated by hand across two languages. This is a real maintenance hazard today, independent of LangChain.

### 2.3 LLM Orchestration Dependency Audit

| Package | LLM SDKs present? |
|---|---|
| `workers/api` | `hono`, `zod` — **zero LLM SDKs** |
| `packages/core` | `@openfusion/shared` only — **zero LLM SDKs** |
| `packages/shared` | `zod` only |
| `packages/db` | `drizzle-orm` |
| `apps/runner-go` | Go stdlib `os/exec` — **zero LLM SDKs** |

**Finding:** openFusion has no `openai`, no `@anthropic-ai/sdk`, no `@langchain/*`, no `ai` (Vercel). Every LLM interaction is either a CLI subprocess or a Cloudflare Workers AI binding. This is a deliberate architectural choice (ADR-001: cloud = control, runner = execution), not an oversight.

---

## 3. LangChain Capability Map vs. openFusion Needs

I mapped each LangChain capability to a concrete openFusion pain point. The table uses evidence from the codebase.

| LangChain capability | openFusion need | Current code | Fit | Value |
|---|---|---|---|---|
| `ChatPromptTemplate` / `PromptTemplate` | Prompt construction is hand-rolled string concat, duplicated TS↔Go | `prompt-builder.ts`, `prompts.go` | Partial | **Medium** |
| `withStructuredOutput()` (Zod) | Judge output parsed via `JUDGE_ANALYSIS_JSON:` markers + defensive `normalizeJudgeResult()` | `judge.ts:36-73` | Strong | **High** |
| `StructuredOutputParser` | Same as above | `judge.ts` | Strong | **High** |
| `ChatOpenAI` / `ChatAnthropic` model abstractions | No direct API calls today; CLI adapters instead | `runner.go:runSelectedModel()` | Weak | **Low (now)** / Medium (future AI Gateway) |
| `RunnableSequence` (chains) | Pipeline is async, distributed, resumable across Worker+Runner+DO | `runs.ts:createRunFromRequest()` | Poor | **Low** |
| `RunnableParallel` | Panel runs in parallel via goroutines (Go) + D1 job queue (cloud) | `runner.go:143-158`, `runs.ts` | Poor | **Low** |
| LangGraph (stateful graph) | Fusion is a DAG: panel→judge→verify→refine | `FusionExecutionPlan.steps` + `dependsOn` | Medium | **Medium (future)** |
| Retrievers / Vector stores | No RAG today; project context is heuristic file-tree text | `context/context.go:Gather()` | None today | **High (future)** |
| Text splitters | Needed when RAG lands | n/a | None today | **Medium (future)** |
| `@langchain/core` callbacks / tracing | Custom audit events + run events already exist | `runs.ts:appendRunEvent()`, `audit.ts` | Weak | **Low** |
| Agents / tool calling | MCP worker is a scaffold; CLI adapters are the "tools" | `workers/mcp`, `adapters/*` | Medium | **Medium (future)** |

---

## 4. Where LangChain Would Help — Detailed

### 4.1 HIGH VALUE: Structured output for the judge stage

**The problem (real, evidenced):**

`packages/core/src/fusion/judge.ts:36-42`:
```ts
export function parseJudgeResult(value: string): JudgeResult {
  try {
    return normalizeJudgeResult(JSON.parse(extractJudgeAnalysisJson(value)) as Partial<JudgeResult>);
  } catch {
    return createEmptyJudgeResult("Judge output was not valid JSON.");
  }
}
```

The judge is asked to emit JSON after a `JUDGE_ANALYSIS_JSON:` marker, then a final answer after `FINAL_OUTPUT:`. Parsing is fragile: it relies on string markers, falls back to an empty result on any JSON error, and `normalizeJudgeResult()` (lines 44-73) defensively coerces every field because models routinely emit slightly-wrong shapes. The Go side duplicates this with `extractFinalOutput()` and `extractSynthesisAnalysis()`.

**How LangChain helps:**

`withStructuredOutput(zodSchema)` uses the provider's native structured-output mode (OpenAI `response_format: json_schema`, Anthropic tool-based structured output) and returns a typed, validated object. No markers, no regex, no defensive coercion.

**Where to use it:**
- `packages/core/src/fusion/judge.ts` — replace `parseJudgeResult()` with a structured-output call when the judge model is reached via an API path (AI Gateway / OpenRouter / direct API key).
- Keep the marker-based parser as a **fallback** for CLI-adapter models that don't support structured output (opencode/codex subprocesses return free text).

**Why this is the right first step:**
- It touches the single most fragile code path in the pipeline.
- It is additive: the fallback path stays for CLI models.
- It is small: one package, one function, no orchestration change.
- Zod schemas already exist in `packages/shared/src/zod.ts` — reuse them directly.

**Caveat:** This only helps when the judge model is called via an API. Today the judge runs through the Go runner's CLI adapters. So this improvement lands when either (a) the cloud path calls the judge via AI Gateway directly, or (b) the Go runner gains an API-call mode. Until then, this is a **design-time** improvement, not an immediate drop-in.

### 4.2 MEDIUM VALUE: Prompt templates as first-class objects

**The problem:**

Prompts are built with `parts.push(...)` / `parts = append(parts, ...)` string concatenation in two languages. There is no prompt versioning, no prompt storage, no A/B testing, no per-model prompt variant. The V1 and V2 judge prompts (`buildJudgeSynthesisPrompt` vs `buildJudgeSynthesisPromptV2`) are gated by a feature flag (`FEATURE_SYNTHESIS_V2`) and live as separate functions.

**How LangChain helps:**

`ChatPromptTemplate.fromMessages()` gives composable, typed message templates with variable interpolation. `PromptTemplate` supports partial application and serialization to JSON (store in R2/D1 for versioning).

**Where to use it:**
- `packages/core/src/fusion/prompt-builder.ts` — express panel/judge/final prompts as templates.
- Store serialized templates in R2 with D1 metadata pointers (matches ADR-004: R2 for payloads, D1 for metadata).
- Version prompts per preset; allow admin override from the web UI (product plan §12.1 screen 7: Presets).

**Why it helps:**
- Eliminates the TS↔Go drift risk IF we also generate the Go prompt strings from the same template source (e.g., emit Go source from the TS templates at build time, or share a JSON template format both languages read).
- Unlocks prompt A/B testing and per-preset prompt variants, which the product plan implies but the code can't support today.

**Caveat:** LangChain.JS templates don't run in Go. We'd still need a sharing strategy. The realistic path is: define templates as JSON in `configs/`, write a tiny interpreter in both TS and Go. LangChain's `PromptTemplate` can consume that JSON on the TS side.

### 4.3 MEDIUM VALUE (FUTURE): LangGraph for agentic fusion

**The problem (emerging):**

The current pipeline is a fixed DAG: panel → judge → (maybe verify → refine). The product plan (§10) describes future modes that are inherently cyclic and stateful:
- "Same-Model Self-Fusion" with roles and temperatures (§10.5)
- Agentic panel models that call tools iteratively
- Verify-and-refine loop (`verify.go`) — already a cycle, currently hardcoded to one refinement pass

**How LangGraph helps:**

LangGraph models stateful, cyclic, multi-actor graphs with checkpointing. The verify→refine loop is a natural LangGraph cycle. Panel models that call tools are LangGraph agents.

**Where to use it (when):**
- A new `packages/agent` (or `packages/core/src/agent`) that runs **in the Go runner** or a future cloud-execution path — NOT in the Worker.
- Only when fusion moves from "one-shot panel + judge" to "iterative agentic panel with tool calls."

**Why it's medium, not high:**
- LangGraph is Python-first; LangGraph.JS exists but is younger.
- The current `FusionExecutionPlan` + Durable Object orchestration already handles distributed, resumable, multi-step execution with audit trails — which is what LangGraph's checkpointing provides in-process. Replacing it would be a rewrite, not an improvement.
- LangGraph runs in one process. openFusion's whole point is cross-plane (Worker + Runner) execution. LangGraph can't span that boundary.

### 4.4 HIGH VALUE (FUTURE): RAG for codebase context

**The problem (not yet present, but planned):**

Today, project context is gathered heuristically in Go: `contextpkg.Gather()` walks the file tree, detects git info, infers stack. It renders a text bundle prepended to prompts. This is zero-token, fast, but not retrieval — it's a dump. For large workspaces, this either overflows the context window or omits relevant files.

**How LangChain helps:**

LangChain's retriever + vector store + text splitter abstractions are the de-facto standard for RAG. `RecursiveCharacterTextSplitter`, `MemoryVectorStore` / `CloudflareVectorize`, and retriever chains would let the panel and judge pull only relevant files/chunks.

**Where to use it (when):**
- A new `packages/retrieval` service.
- Vector store: **Cloudflare Vectorize** (matches the Cloudflare-first ADR-001). LangChain has a `CloudflareVectorize` integration.
- Embeddings: `@cf/baai/bge-base-en-v1.5` via Workers AI binding (already available as `env.AI`).
- Trigger: when workspace context exceeds a token budget (e.g., >8k tokens of file text).

**Why this is the strongest future LangChain use case:**
- It's a greenfield feature, not a rewrite.
- LangChain's retriever abstractions are genuinely best-in-class.
- It fits the Cloudflare stack (Vectorize + Workers AI embeddings).
- It benefits both panel (grounding) and judge (evidence) stages.

---

## 5. Where LangChain Would Hurt — Detailed

### 5.1 Cloudflare Workers bundle and runtime constraints

LangChain.JS is large and Node-leaning. `@langchain/core` + `@langchain/openai` + `@langchain/anthropic` add hundreds of KB to a bundle. After OpenNext, the Worker bundle is already under pressure. Workers also lack Node APIs (`fs`, `child_process`, `stream` in full form) that LangChain often expects.

**Risk:** Adopting LangChain in `workers/api` could blow the bundle size budget and require polyfills that add further weight. The current zero-LLM-SDK Worker is intentionally lean.

**Mitigation:** If we adopt any LangChain in the Worker, restrict it to `@langchain/core` primitives (output parsers, prompt templates) which are lighter. Keep model clients (`@langchain/openai`, etc.) out of the Worker — run them in the Go runner or a future cloud-execution container.

### 5.2 CLI-subprocess execution is not LangChain's model

LangChain's `ChatOpenAI`, `ChatAnthropic`, etc. wrap HTTP APIs. openFusion's adapters wrap CLI subprocesses (`opencode run`, `codex exec`). There is no LangChain abstraction for "run a coding agent CLI and parse its stdout events." Building a `Runnable` wrapper around a subprocess is possible but buys nothing over the existing `adapters.Adapter` interface (`Detect`, `ListModels`, `HealthCheck`, `Run`), which is already clean and typed.

**Finding:** The adapter layer is the heart of openFusion's value proposition (local-runner-aware, subscription-reuse). LangChain does not address this layer. Adopting LangChain here would be ceremony without benefit.

### 5.3 Distributed orchestration > in-process chains

`RunnableSequence` and `RunnableParallel` run in one process. openFusion's panel runs across:
- Multiple Go goroutines (local mode), OR
- Multiple runner sessions + Durable Object fanout + D1 job queue (cloud mode)

The cloud path is async, resumable, pausable, retryable, and auditable (`runs.ts:pauseRun`, `resumeRun`, `cancelRun`, `retryPanelJob`, `advanceFusionRunAfterJob`). This is a distributed workflow engine. LangChain chains are not a replacement.

**Finding:** Do not port `FusionExecutionPlan` / `advanceFusionRunAfterJob` onto LangChain chains. The current design is more capable for this use case.

### 5.4 Go runner cannot use LangChain.JS

Half the fusion logic lives in Go (`apps/runner-go/internal/fusion`). LangChain.Go exists but is far less mature and not API-compatible with LangChain.JS. Any LangChain.JS adoption in `packages/core` widens the TS↔Go drift unless we also port to LangChain.Go (immature) or generate Go from TS (custom tooling).

**Finding:** LangChain adoption must be TS-only and must come with a cross-language sharing strategy for prompts and schemas. Otherwise it increases the drift risk that already exists today.

### 5.5 Abstraction leakage and churn

LangChain's API changes frequently between minor versions. The openFusion codebase currently has stable, typed interfaces (`ModelRef`, `FusionExecutionStep`, `JudgeResult`) with no external churn. Introducing LangChain imports a churn surface that the team does not control.

**Mitigation:** If we adopt LangChain primitives, wrap them behind our own interfaces (e.g., a `parseJudgeStructured()` function that internally uses `withStructuredOutput` but exposes our `JudgeResult` type). Never let LangChain types leak into `packages/shared`.

---

## 6. Recommendation: Selective Primitive Adoption

### 6.1 Adoption tiers

| Tier | Action | When |
|---|---|---|
| **Tier 1 — Adopt now** | `@langchain/core` structured output + output parsers, wrapped behind our interfaces | When the judge gains an API-call path (AI Gateway / OpenRouter / direct API key) |
| **Tier 2 — Adopt next** | `PromptTemplate` with JSON-serialized templates shared TS↔Go | When prompt variants per preset land (product plan §11) |
| **Tier 3 — Adopt when RAG lands** | LangChain retrievers + `CloudflareVectorize` + Workers AI embeddings | When workspace context exceeds token budgets (greenfield feature) |
| **Tier 4 — Evaluate for agentic fusion** | LangGraph.JS for cyclic verify→refine and tool-calling panel agents | When fusion moves to iterative agentic mode (post-Phase 8) |
| **Do NOT adopt** | LangChain chains as the orchestration layer; LangChain model clients in the Worker | Never (architectural mismatch) |

### 6.2 Concrete integration points (LLD)

#### Tier 1 — Structured judge output

**File:** `packages/core/src/fusion/judge.ts`

Add a new function alongside the existing parser:

```ts
// Pseudocode — not a commit, a design target
import { withStructuredOutput } from "@langchain/core";
import { judgeResultSchema } from "@openfusion/shared";

export async function parseJudgeStructured(
  model: ModelRef,
  prompt: string,
): Promise<JudgeResult> {
  if (!supportsStructuredOutput(model)) {
    // Fallback: existing marker-based parser for CLI adapters
    return parseJudgeResult(await runModel(model, prompt));
  }
  const structured = withStructuredOutput(model, judgeResultSchema);
  return structured.invoke(prompt);  // typed, validated, no markers
}
```

**Boundary rule:** `packages/shared` must not import `@langchain/*`. The LangChain dependency lives in `packages/core` only, behind our types.

**Cost:** ~1 new dependency (`@langchain/core`), ~1 new function, ~1 wrapper interface. No orchestration change.

#### Tier 2 — Shared prompt templates

**New file:** `configs/prompts/*.json` — serialized prompt templates consumed by both TS and Go.

**TS side:** `packages/core/src/fusion/prompt-loader.ts` reads JSON, wraps with `PromptTemplate`.

**Go side:** `apps/runner-go/internal/fusion/prompt-loader.go` reads the same JSON, interpolates with `text/template`.

**Benefit:** Eliminates the TS↔Go drift that exists today in `prompt-builder.ts` vs `prompts.go`. This is valuable **independent** of LangChain — LangChain's `PromptTemplate` is just the TS-side consumer.

#### Tier 3 — RAG (future, outline only)

**New package:** `packages/retrieval`

```
packages/retrieval/
├── src/
│   ├── embed.ts          # Workers AI embeddings via env.AI
│   ├── store.ts          # CloudflareVectorize wrapper
│   ├── splitter.ts       # RecursiveCharacterTextSplitter (LangChain)
│   ├── retrieve.ts       # Retriever chain
│   └── index.ts
└── package.json          # depends on @langchain/core, @langchain/community
```

**Integration:** `apps/runner-go/internal/context/context.go:Gather()` calls a new cloud endpoint that returns retrieved chunks instead of a full file-tree dump. Or, the Go runner calls Vectorize directly (Go SDK) — avoiding LangChain entirely on the Go side.

---

## 7. Decision Matrix

| Option | Effort | Risk | Value | Verdict |
|---|---|---|---|---|
| A. Full LangChain framework adoption (orchestration + models + prompts) | Very High | High (bundle, churn, mismatch) | Low (replaces working code) | **Reject** |
| B. LangChain in Worker only, full stack | High | High (Workers limits) | Low | **Reject** |
| C. Tier 1 only: structured output for judge | Low | Low (additive, fallback kept) | High | **Accept when API path lands** |
| D. Tier 1 + Tier 2: structured output + shared prompt templates | Medium | Low | High | **Best near-term path** |
| E. Tier 3 only: RAG with LangChain retrievers | Medium | Low (greenfield) | High | **Accept when RAG is prioritized** |
| F. No LangChain, keep hand-rolled | Zero | Zero | Baseline | **Acceptable default** |

**Recommended path:** **D** (Tier 1 + Tier 2) once the judge has an API-call path. Until then, **F** (status quo) is correct — there is no API-call path for LangChain to wrap, so adopting it now would add a dependency with no runtime benefit.

---

## 8. Triggers for Re-evaluation

Revisit this report when any of the following happens:

1. **AI Gateway direct API-key model routing lands in the Worker.** This creates the API-call path that makes Tier 1 valuable. (Product plan §8: AI Gateway role.)
2. **Workspace context starts overflowing model context windows.** This triggers Tier 3 (RAG).
3. **Fusion moves to iterative agentic mode** (panel models call tools, verify→refine loops more than once). This triggers Tier 4 (LangGraph evaluation).
4. **Prompt variants per preset / per model become a product requirement.** This triggers Tier 2.
5. **LangChain.JS adds a first-class Cloudflare Workers runtime target** with tree-shaking that fits the bundle budget. This lowers the risk of broader adoption.
6. **The TS↔Go prompt drift causes a production bug.** This triggers Tier 2 immediately, independent of LangChain.

---

## 9. Risks of Adopting LangChain (and Mitigations)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Workers bundle size blow-up | High if model clients are imported | High (deploy fails) | Keep `@langchain/openai` etc. out of Worker; use `@langchain/core` only |
| LangChain API churn breaks builds | Medium | Medium | Pin exact versions; wrap behind our interfaces; CI typecheck |
| TS↔Go drift widens | Medium | Medium | Shared JSON prompt templates (Tier 2); never put logic in LangChain that Go must replicate |
| Team learns LangChain's mental model instead of the fusion domain | Medium | Medium | Keep LangChain behind small, named interfaces; domain code stays framework-free |
| Over-abstraction: LangChain wrappers around CLI subprocesses | Low | Medium | Do not wrap adapters in `Runnable`. Adapters stay as-is. |
| Lock-in to LangChain's structured-output format | Low | Low | Zod schemas are ours; LangChain is one consumer of them |

---

## 10. What This Report Does NOT Recommend

To be explicit, because LangChain marketing is aggressive:

- **Do NOT** replace `FusionExecutionPlan` / `advanceFusionRunAfterJob` with LangChain chains or LangGraph. The current distributed orchestration is more capable.
- **Do NOT** add `@langchain/openai` or `@langchain/anthropic` to `workers/api`. The Worker doesn't call these APIs; the Go runner does, via CLIs.
- **Do NOT** wrap the OpenCode/Codex CLI adapters in LangChain `Runnable`s. They are subprocess executors, not LLM calls.
- **Do NOT** adopt LangChain in the Go runner. LangChain.Go is too immature and the runner's fusion code is clean.
- **Do NOT** adopt LangChain for tracing/callbacks. The existing audit event + run event system (`appendRunEvent`, `createAuditEvent`) is purpose-built and auditable; LangChain callbacks would duplicate it.
- **Do NOT** adopt LangChain just because "it's the standard." openFusion's architecture (CLI-subprocess, two-plane, Cloudflare-native) is non-standard by design.

---

## 11. Final Recommendation

**Adopt LangChain as a library of primitives, not a framework. Start with Tier 1 (structured judge output) when the API-call path lands. Add Tier 2 (shared prompt templates) when prompt variants become a product need. Plan Tier 3 (RAG) for the workspace-context scaling problem. Defer Tier 4 (LangGraph) until fusion becomes agentic.**

The single highest-leverage improvement is **not** LangChain adoption — it is **eliminating the TS↔Go prompt/parsing drift** (Tier 2's shared-template work), which can be done with or without LangChain. If the team does only one thing from this report, do that.

---

## Appendix A — Evidence Index

| Claim | Source |
|---|---|
| Worker has no LLM SDK | `workers/api/package.json` (deps: hono, zod, internal packages) |
| Core has no LLM SDK | `packages/core/package.json` (deps: @openfusion/shared only) |
| Judge parsing is marker-based | `packages/core/src/fusion/judge.ts:36-89` |
| Judge normalization is defensive | `packages/core/src/fusion/judge.ts:44-73` |
| Prompts are string concat, duplicated | `packages/core/src/fusion/prompt-builder.ts` + `apps/runner-go/internal/fusion/prompts.go` |
| Panel runs via goroutines (Go) | `apps/runner-go/internal/fusion/runner.go:143-158` |
| Cloud orchestration is distributed | `workers/api/src/services/runs.ts:126-304` (createRunFromRequest) |
| Verify→refine is a cycle | `apps/runner-go/internal/fusion/verify.go` + `runner.go:215-243` |
| Only direct Worker LLM call is title gen | `workers/api/src/services/runs.ts:1235` (`env.AI.run`) |
| OpenAI endpoint queues, doesn't proxy | `workers/api/src/routes/openai-compatible.ts:42-85` |
| Project context is heuristic, not RAG | `apps/runner-go/internal/context/context.go:Gather` |
| FusionWorkflow is a scaffold | `workers/api/src/workflows/FusionWorkflow.ts` (7 lines) |
| Architecture is two-plane by design | `Docs/FH_PRODUCT_PLAN.md` §7, ADR-001, ADR-002 |

## Appendix B — LangChain Primitive Quick Reference (for the team)

| Primitive | Package | What it does | openFusion use |
|---|---|---|---|
| `withStructuredOutput(schema)` | `@langchain/core` | Forces model to return schema-valid JSON | Judge result parsing (Tier 1) |
| `StructuredOutputParser` | `@langchain/core` | Parses + validates structured output | Judge result parsing (Tier 1) |
| `PromptTemplate` | `@langchain/core` | Typed prompt with variables | Panel/judge prompts (Tier 2) |
| `ChatPromptTemplate` | `@langchain/core` | Message-level prompt template | Panel/judge prompts (Tier 2) |
| `RecursiveCharacterTextSplitter` | `@langchain/textsplitters` | Splits docs into chunks | RAG (Tier 3) |
| `CloudflareVectorize` | `@langchain/community` | Vector store on CF Vectorize | RAG (Tier 3) |
| `RunnableSequence` | `@langchain/core` | Chain of runnables | **Not recommended** (use our orchestration) |
| `RunnableParallel` | `@langchain/core` | Parallel runnables | **Not recommended** (use goroutines / job queue) |
| `StateGraph` (LangGraph) | `@langchain/langgraph` | Stateful cyclic graph | Agentic fusion (Tier 4, future) |