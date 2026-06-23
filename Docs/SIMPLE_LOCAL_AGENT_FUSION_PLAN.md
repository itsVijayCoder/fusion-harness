# Simple Local Agent Fusion Plan

## 1. Direction Reset

The product should be a connection layer between the user interface and the AI agent CLIs the user already has installed. It should not become a new agent harness, a model gateway, or a replacement runtime for OpenCode, Codex, Claude Code, Copilot, or similar tools.

The user flow is simple:

```text
User prompt / requirement
  -> user selects local agent models visible on this machine
  -> each selected model runs through its own native CLI/session/environment
  -> collect all model outputs
  -> judge/synthesis model runs through its own native CLI/session/environment
  -> judge/synthesis model compares outputs, combines the best parts, and returns one final answer
  -> UI shows prompt, panel outputs, judge analysis, and the single final result
  -> user can continue chatting and improve the result
```

The goal is to get premium-model-like output by combining cheaper or already-available models, while preserving each agent's native strengths.

## 2. Core Product Rules

1. openFusion is only the connector and coordinator.
2. Every model run must happen inside that agent's own native CLI environment.
3. A selected OpenCode model runs through OpenCode.
4. A selected Codex model runs through Codex.
5. A selected Claude model runs through Claude Code.
6. A selected Copilot model runs through Copilot.
7. No model should be executed by a openFusion-built fake agent runtime.
8. Local model availability must be discovered live per user and per machine.
9. Local agent model catalogs must not be stored in the database.
10. The UI can store the user's last selection locally, but not as a shared server model catalog.
11. The database may store run history and the exact model strings used for a run, because that is an execution record, not an available-model catalog.
12. If an agent cannot list models, show only `default` plus an explicit custom model input for that agent.
13. Do not show hardcoded suggested local models as if the user has them.
14. Do not read provider tokens, cookies, keychains, or credential files.
15. Let the native CLI use its own authentication exactly as it normally would.
16. The judge model and final model are the same selected model/process.
17. There is no separate final-writer model in the simple flow.

## 3. What We Are Building

openFusion should provide:

1. Local agent detection.
2. Live model discovery from the user's installed CLIs.
3. A thin adapter per agent CLI.
4. Parallel execution of selected panel models.
5. A judge/synthesis step that compares panel outputs and produces the requested final output.
6. A chat UI that shows:
   - original prompt
   - selected panel models
   - raw/submodel outputs
   - judge analysis
   - final result from the judge/synthesis model
   - follow-up chat turns
7. Optional run history, trace, and artifacts.

openFusion should not provide:

1. A new model runtime.
2. A DB-backed local model marketplace.
3. A generic "Fusion model" that hides where work ran.
4. Server-side guessing of which local models a user has.
5. Heavy abstractions that reduce the quality of native agents.
6. Provider credential management for local CLI sessions.

## 4. Current Repo Fit

The repo already has useful pieces:

| Area | Current status | Keep / change |
| --- | --- | --- |
| Go local runner | Present in `apps/runner-go` | Keep as execution connector |
| Local agent catalog | Present in `internal/localagents` | Keep detection, simplify model display rules |
| OpenCode adapter | Present | Keep, make it streaming/PTY-capable where needed |
| Codex adapter | Present | Keep, make it streaming/PTY-capable where needed |
| Fusion runner | Present in `internal/fusion` | Change to panel -> judge/synthesis flow |
| Local UI | Present in `internal/localui` | Keep as closest implementation of this plan |
| Hosted web UI | Present | Change model source from DB catalog to live runner/session data |
| DB `models` table | Present | Do not use for local discovered models |
| Suggested model lists | Present in UI and adapters | Hide from normal picker; only show live models, `default`, or user-entered custom IDs |
| Cloud control plane | Present | Optional for sync/history; not required for the simple local-first goal |

The biggest mismatch is model storage. Current cloud code treats models as database records. The new direction should treat local models as live capabilities from the user's runner session.

## 5. Target Architecture

```text
Browser UI
  |
  | live agents/models, create run, stream trace
  v
Local runner or runner session API
  |
  | detects installed CLIs
  | spawns each selected native CLI process
  v
Native agents
  - OpenCode CLI
  - Codex CLI
  - Claude Code CLI
  - GitHub Copilot CLI
  - other installed agents later

Panel outputs
  -> Judge/synthesis native CLI run
  -> UI response
```

For local-only mode, the browser can talk to the local Go runner UI/API directly.

For hosted mode, the hosted API should only coordinate an online runner session. It should not maintain a persistent DB catalog of the user's local models.

## 6. Native Agent Execution Contract

Each adapter should be a thin connector:

```go
type NativeAgentAdapter interface {
  ID() string
  Detect(ctx) DetectionResult
  ListModels(ctx) ([]ModelRef, error)
  Run(ctx, input RunInput, emit EventSink) (*RunResult, error)
  Continue(ctx, input ContinueInput, emit EventSink) (*RunResult, error) // optional
}
```

Adapter responsibilities:

1. Locate the real binary.
2. Probe version.
3. Ask the CLI for models only if the CLI supports that.
4. Build the native CLI command.
5. Pass the prompt through the CLI-supported input path.
6. Use the user's workspace and CLI configuration.
7. Capture stdout/stderr/stream events.
8. Return the native output without pretending it came from openFusion.

Adapter non-responsibilities:

1. Do not implement model reasoning.
2. Do not normalize provider model IDs across unrelated CLIs.
3. Do not invent unavailable models.
4. Do not read credentials.
5. Do not store model availability.

## 7. Model Discovery Rules

The model picker must be live and user-specific.

Discovery order:

1. Detect installed agents from the user's machine.
2. For each available agent, call its native model-list command if available.
3. Add `default` for every detected agent. `default` means do not pass a model flag and let the CLI use its own configured model.
4. If live listing succeeds, show only those live models for that agent.
5. If live listing fails or the CLI does not support model listing, show only:
   - `default`
   - "Custom model ID" input
6. Persist only the user's selection locally, such as browser localStorage or local runner config.
7. Do not write discovered local models to D1/Postgres/SQLite model catalog tables.

Example:

```text
User A has:
  OpenCode: openai/gpt-5, deepseek/deepseek-chat, moonshotai/kimi-k2
  Codex: default, gpt-5-codex

User B has:
  Claude Code: default, sonnet
  Copilot: default

User A and User B should see different pickers.
The database should not try to make these lists global.
```

## 8. Process Execution Rules

When the user selects:

```text
Panel:
  opencode/openai/gpt-5
  opencode/deepseek/deepseek-chat
  codex/gpt-5-codex

Judge:
  codex/gpt-5-codex
```

openFusion should run:

```text
Process 1: OpenCode CLI with model openai/gpt-5
Process 2: OpenCode CLI with model deepseek/deepseek-chat
Process 3: Codex CLI with model gpt-5-codex
Process 4: Codex CLI judge/synthesis run with model gpt-5-codex
```

Rules:

1. Run panel models in parallel.
2. Run each selected model as a separate process/session.
3. Pass model IDs only using that CLI's native model flag or config mechanism.
4. If the model is `default`, omit the model flag.
5. Use PTY execution when a CLI needs a terminal.
6. Use non-interactive/stdin execution when the CLI officially supports it.
7. Preserve the user's normal CLI environment for agent execution.
8. Redact secrets from logs and events instead of removing needed environment variables from the child process.
9. Use separate temporary working copies/worktrees for file-editing runs to prevent panel models from overwriting each other.
10. Use read-only mode for pure analysis runs.
11. The judge/synthesis process is responsible for both comparison and the single final result.

## 9. Prompting Strategy

The prompt layer should be light. It should guide the selected agents without turning openFusion into an agent.

Panel prompt:

1. Include the user's original task exactly.
2. Tell the model to work independently.
3. Ask for concrete reasoning, risks, assumptions, and recommended final answer.
4. For coding tasks, ask for files, commands, tests, and patch strategy.
5. Do not force a huge custom framework on every model.

Judge/synthesis prompt:

1. Include the original user task.
2. Include all successful panel outputs.
3. Ask for strict comparison:
   - consensus
   - contradictions
   - missing coverage
   - unique insights
   - likely mistakes
   - risks
   - confidence
   - final synthesis strategy
4. Ask the same judge/synthesis model to combine the best supported parts into one final answer.
5. Require the final answer to follow the user's requested format.
6. Use the best supported ideas from the panel.
7. Ignore unsupported or contradicted claims.
8. Be direct and production-quality.

Recommended judge/synthesis output shape:

```text
JUDGE_ANALYSIS_JSON:
{
  "consensus": [],
  "contradictions": [],
  "missing_coverage": [],
  "unique_insights": [],
  "risks": [],
  "confidence": 0.0,
  "synthesis_strategy": "..."
}

FINAL_OUTPUT:
<single final answer in the user's requested format>
```

The UI should render `JUDGE_ANALYSIS_JSON` as the comparison trace and `FINAL_OUTPUT` as the result. If an API caller asks for only the final answer, return only `FINAL_OUTPUT` while keeping the analysis in the trace.

Format lock:

```text
If the user asks for Markdown, return Markdown.
If the user asks for JSON, return valid JSON only.
If the user asks for code, return code in the expected structure.
If the user asks for a plan file, produce a plan file.
```

## 10. UI Plan

The main screen should be a chat console, not a dashboard-first product.

First viewport:

1. Prompt composer.
2. Live detected agent/model picker.
3. Selected panel models.
4. Judge/synthesis model selector.
5. Permission mode:
   - read-only
   - workspace write
   - trusted

Run result screen:

1. Original prompt at the top.
2. Panel outputs, one section/tab per selected model.
3. Judge analysis in structured form.
4. Single final result from the same judge/synthesis run.
5. Follow-up composer below the final result.

Continuous chat:

1. User sends follow-up.
2. The system keeps the conversation thread.
3. Each selected agent gets the relevant conversation context.
4. If the native CLI supports session resume, use its native resume/session feature.
5. If not, send the summarized conversation context with the new prompt.
6. The UI appends a new fusion turn with new panel outputs and one judge/synthesis result.

## 11. Data Storage Plan

Do not store local available models in the database.

Allowed storage:

| Data | Where | Reason |
| --- | --- | --- |
| Last selected panel and judge/synthesis choices | Browser localStorage or local runner config | User preference only |
| Live detected agent list | In-memory runner response or session cache with short TTL | Current machine state |
| Run prompt | Optional run history/artifact store | Needed for trace/history |
| Panel outputs | Optional run history/artifact store | Needed to show result |
| Judge/synthesis output | Optional run history/artifact store | Needed to show analysis and final result |
| Exact model string used in a run | Run event/history | Execution record, not catalog |

Disallowed storage:

| Data | Why not |
| --- | --- |
| User A's full local OpenCode model list in DB | It is user/machine-specific and may change |
| User B's Codex local model list in org catalog | It is not globally valid |
| Fallback/suggested local models as selectable detected models | It makes the UI lie about availability |
| Provider credentials or token-derived metadata | Security risk and unnecessary |

DB schema direction:

1. Keep `fusion_runs`, `runner_jobs`, `run_events`, and artifacts if history is needed.
2. Remove the requirement that `panel_outputs.model_id` references a `models` table for local runs.
3. Store `adapter`, `model`, and `model_id` as plain strings in run/job/event records.
4. Keep a `models` table only for team-managed cloud/API-key models if that feature remains.
5. Do not populate `models` with live local CLI discoveries.

## 12. API Plan

Local runner API:

```text
GET  /api/agents
  -> live detected agents and live models for this user/machine

POST /api/fusion/runs
  -> create local fusion run

GET  /api/fusion/runs/:id/events
  -> stream panel and judge/synthesis events

POST /api/fusion/runs/:id/messages
  -> continue the conversation
```

Hosted API, if kept:

```text
GET /api/models
  -> proxy/live-read from the user's active runner session
  -> no DB model catalog for local CLI models

POST /api/fusion/runs
  -> enqueue jobs to the user's active runner

GET /api/fusion/runs/:id/events
  -> stream trace from Durable Object/session
```

The hosted API can cache live runner models in memory or Durable Object storage with a short TTL, but should not persist them as a global model catalog.

## 13. Adapter Priority

V1 adapters:

1. OpenCode
2. Codex

V1.1 adapters:

1. Claude Code
2. GitHub Copilot CLI

V1.2 adapters:

1. Gemini CLI
2. Cursor Agent
3. Qwen/Kimi/DeepSeek if the native CLIs are installed and support non-interactive runs

Each new adapter must answer:

1. How to detect the binary?
2. How to check auth without reading secrets?
3. How to list live models, if supported?
4. How to run a prompt non-interactively?
5. Does it need a PTY?
6. How does continuation/session resume work?
7. How should output be parsed?
8. Which permission modes are safe?

## 14. Achieving Premium Output With Cheap Models

The quality comes from orchestration, not from pretending cheap models are premium.

Use these techniques:

1. Diversity: choose models from different providers or reasoning styles.
2. Independence: panel models should not see each other's answers.
3. Role pressure: give light roles like architect, critic, implementer, risk reviewer.
4. Judge rigor: force comparison, contradiction detection, missing coverage, and final synthesis in one run.
5. Format lock: the judge/synthesis final output must obey the user's requested format.
6. Error honesty: failed/empty panel outputs should be visible and excluded from synthesis.
7. Optional QA: allow a cheap extra review pass only when the user enables it.

Recommended default for cost-effective quality:

```text
Panel:
  2 to 4 cheap/available models

Judge:
  strongest available reasoning model the user has
  also produces the final answer
```

## 15. Implementation Phases

### Phase 1: Simplify Model Discovery

Goal: show only models the user really has.

Tasks:

1. Change `/api/models` in the hosted app to read from the active runner session, not the DB `models` table.
2. Keep local UI `/api/models` live from `localagents.ListModels`.
3. Remove normal UI display of hardcoded suggested models.
4. Change adapters so fallback model lists are not treated as detected availability.
5. For non-listable CLIs, show `default` plus custom input only.
6. Store last selection in localStorage/local runner config only.

Acceptance:

1. Two users with different installed CLIs see different model lists.
2. Refreshing the model picker reruns live discovery.
3. No discovered local model rows are inserted into DB.

### Phase 2: Make Native Execution First-Class

Goal: every selected model runs through its own CLI process.

Tasks:

1. Introduce an adapter registry instead of hardcoding only OpenCode/Codex in `fusion.Execute`.
2. Add PTY-capable process execution for CLIs that require a real terminal.
3. Keep stdin/non-interactive execution for CLIs that support it well.
4. Preserve the user's agent environment while redacting secrets from logs/events.
5. Emit standardized events for started, delta, completed, failed.
6. Add per-job process/session IDs.

Acceptance:

1. Selecting two OpenCode models starts two independent OpenCode runs.
2. Selecting one Codex model starts one Codex run.
3. Judge/synthesis runs through the selected judge CLI.
4. No separate final-writer process is started.

### Phase 3: Improve Fusion Quality

Goal: produce consistently strong final answers.

Tasks:

1. Tighten panel prompt to be concise and independent.
2. Tighten judge/synthesis output schema and parser.
3. Add judge confidence and risk scoring to UI.
4. Add judge/synthesis format-lock instruction.
5. Add degradation behavior when one panel fails.
6. Add optional QA pass.

Acceptance:

1. Final output follows requested format.
2. Judge/synthesis identifies contradictions and missing coverage.
3. Final result uses strongest supported points, not all points blindly.

### Phase 4: Continuous Chat

Goal: user can keep improving the result.

Tasks:

1. Add thread state to the UI.
2. Add `POST /api/fusion/runs/:id/messages`.
3. Store previous final result and compact context.
4. Use native CLI continuation where supported.
5. Fall back to sending summarized context for CLIs without resume support.
6. Show each fusion turn separately.

Acceptance:

1. User can ask follow-up questions.
2. New panel outputs and one judge/synthesis result are generated for the follow-up.
3. The UI keeps the conversation understandable.

### Phase 5: Optional History and Cloud Sync

Goal: keep useful traces without turning local model availability into DB state.

Tasks:

1. Store run history, prompts, outputs, and artifacts if history is enabled.
2. Store selected model strings used in each run.
3. Do not store all live available local models.
4. Add retention controls.
5. Add "local only" mode where run data stays on the machine.

Acceptance:

1. Run history can be reviewed.
2. Model availability remains live and user-specific.
3. Users can disable history/sync.

## 16. Required Code Changes

High-priority changes:

1. `apps/web/src/app/chat/task-console.tsx`
   - Remove `suggestedModels` from normal default picker.
   - Keep custom model input.
   - Use live runner/session model response.

2. `workers/api/src/routes/models.ts`
   - Stop returning local CLI models from DB.
   - Proxy or request live runner model inventory.

3. `workers/api/src/services/runs.ts`
   - Stop requiring `ensureModel` for local CLI selected models.
   - Store selected `adapter`, `model`, and `modelId` directly in run/job/event records.
   - Collapse deferred judge/final planning into one judge/synthesis job for the simple flow.

4. `packages/db/schema.sql`
   - Remove local-run foreign key dependency from `panel_outputs.model_id`.
   - Keep model catalog only for cloud/team-managed models if needed.

5. `apps/runner-go/internal/fusion/runner.go`
   - Replace adapter switch with adapter registry.
   - Support any implemented native agent adapter.

6. `apps/runner-go/internal/executors/host/host.go`
   - Add streaming and PTY support.
   - Redact logs instead of stripping needed environment from the child process in local mode.

7. `apps/runner-go/internal/localagents/catalog.go`
   - Separate live-discovered models from fallback docs/hints.
   - Return fallback suggestions only as non-selectable metadata or remove them from the picker.

Medium-priority changes:

1. Add Claude Code adapter.
2. Add Copilot adapter.
3. Add continuation/resume support where native CLIs support it.
4. Add isolated worktree mode for write-capable panel runs.
5. Add optional QA toggle.

## 17. Security Rules

1. Never read raw tokens, cookies, keychains, or credential files.
2. Native CLIs may use their own auth because the user already configured them.
3. Do not print environment variables into logs.
4. Redact known secret patterns from stdout/stderr before storing or streaming.
5. Default permission should be read-only.
6. Workspace-write mode must be explicit.
7. Parallel write-capable agents should use isolated worktrees.
8. Destructive commands require approval.
9. The UI should clearly show which native CLI produced each output.

## 18. Success Criteria

The simplified product is correct when:

1. A user can open the UI and see only the local agents/models available on their machine.
2. A user can choose three models, for example two OpenCode models and one Codex model.
3. Each chosen model runs in its own native CLI environment.
4. The UI shows every panel result.
5. The selected judge/synthesis model compares all results.
6. The same judge/synthesis model writes a strong single answer in the user's requested format.
7. The user can continue chatting to improve the result.
8. Local model availability is not stored in the DB.
9. Run history, if enabled, records only what was used and produced.
10. The system feels like premium synthesis while still using the user's cheaper/available models.

## 19. Recommended Immediate Next Step

Build the local-first version first:

1. Use `apps/runner-go/internal/localui` as the reference path.
2. Make model discovery honest: live models, `default`, or custom only.
3. Make panel and judge/synthesis execution stream from native CLIs.
4. Add chat continuation.
5. Only after that, reconnect the hosted web app to live runner sessions without a local model DB catalog.

This keeps the product simple: openFusion connects local agents, collects results, judges them, and produces a better final answer. It does not become another agent platform.
