# OpenDesign Local Agents Feature Implementation Report

## Scope

This report explains how to implement the OpenDesign-style local agent detection, model selection, judge model, and final model workflow in Fusion Harness.

Source reference analyzed:

- `/Users/vijay/Documents/Development/Tools/open-design`
- Existing source report: `Docs/local-agents-model-selection-report.md`
- Current OpenDesign implementation files:
  - `apps/daemon/src/agents.ts`
  - `apps/daemon/src/server.ts`
  - `apps/daemon/src/app-config.ts`
  - `apps/web/src/components/SettingsDialog.tsx`
  - `apps/web/src/components/AvatarMenu.tsx`
  - `apps/web/src/components/modelOptions.tsx`

Target repository analyzed:

- `/Users/vijay/Documents/Development/AsthriX/Fusion_Harness/fusion-harness`
- Current in-progress target files:
  - `apps/web/src/app/chat/page.tsx`
  - `apps/web/src/app/chat/task-console.tsx`
  - `apps/web/src/app/runners/page.tsx`
  - `apps/web/src/features/shell/app-shell.tsx`
  - `apps/runner-go/internal/adapters/opencode/opencode.go`
  - `apps/runner-go/internal/adapters/codex/codex.go`
  - `apps/runner-go/cmd/fusion-runner/main.go`
  - `packages/core/src/models/selection.ts`
  - `packages/core/src/fusion/orchestrator.ts`
  - `packages/shared/src/types.ts`
  - `packages/shared/src/zod.ts`
  - `packages/db/src/queries.ts`
  - `workers/api/src/routes/models.ts`
  - `workers/api/src/routes/runners.ts`
  - `workers/api/src/routes/fusion-runs.ts`
  - `workers/api/src/routes/openai-compatible.ts`
  - `workers/api/src/durable-objects/FusionRunDO.ts`
  - `workers/api/src/durable-objects/RunnerSessionDO.ts`

Note: the OpenDesign repo currently has no uncommitted code diff besides documentation. The relevant active code changes are in Fusion Harness.

## Executive Summary

Fusion Harness already has the right high-level primitives for this feature:

- `ModelRef`, `RunnerRef`, `ToolRef`, `FusionRunRequest`
- runner registration with `models?: ModelRef[]`
- database persistence for runner-discovered models
- `/api/models` and OpenAI-compatible `/v1/models`
- a Go runner with OpenCode and Codex adapters
- a redesigned chat UI with analysis, judge, and final model selectors
- core selection support for `analysisModels`, `judgeModel`, and `finalModel`

The remaining work is not to copy OpenDesign one-to-one. The architectures differ:

- OpenDesign is local daemon first: web app talks directly to a local Node daemon.
- Fusion Harness is cloud control plane plus local Go runner: web app talks to Cloudflare, Cloudflare dispatches to a local runner.

The correct implementation is to port the OpenDesign behavior into the Fusion Harness runner/control-plane split:

1. Improve local runner discovery to match OpenDesign's executable/model detection quality.
2. Persist detected model inventory through runner registration.
3. Validate custom model IDs before they can be synthesized or dispatched.
4. Turn the selected analysis/judge/final models into real runner jobs.
5. Stream panel, judge, and final events back through `FusionRunDO`.
6. Store outputs and artifacts in D1/R2.

## Reference Behavior From OpenDesign

OpenDesign's useful design decisions are:

- A central agent catalog defines each local CLI adapter.
- Detection is best-effort and binary-centric.
- Each agent can expose fallback models, dynamic model listing, or custom model detection.
- `default` means "do not pass `--model`; let the CLI config choose."
- OpenCode dynamically lists provider/model IDs with `opencode-cli models`.
- OpenCode prefers `opencode-cli` over `opencode` to avoid launching the desktop GUI binary.
- Codex does not dynamically list models; it uses static hints plus custom input.
- Custom model IDs are allowed only after strict syntactic validation.
- Model selections are per-agent.
- The generation path validates model/reasoning before spawning a CLI.
- Prompts are sent through stdin where possible to avoid command-line length limits.
- Structured stream parsers turn CLI output into typed UI events and failures.

These decisions should be ported, but the persistence and dispatch should use Fusion Harness' cloud/runner architecture.

## Current Fusion Harness State

### Already Implemented

Shared types in `packages/shared/src/types.ts` already model the feature:

```ts
export type ModelRef = {
  id: string;
  adapter: AdapterId;
  provider?: string;
  model: string;
  displayName?: string;
  authMode: AuthMode;
  availability: ModelAvailability;
  capabilities: { ... };
};

export type FusionRunRequest = {
  analysisModels?: string[];
  judgeModel?: string;
  finalModel?: string;
};
```

The Zod contract in `packages/shared/src/zod.ts` accepts those fields.

The DB layer already persists runner models:

- `models` table in `packages/db/src/schema.ts`
- `replaceRunnerModels(...)` in `packages/db/src/queries.ts`
- `listModels(...)` for `/api/models`

The Go runner already has adapter-level model discovery:

- `apps/runner-go/internal/adapters/opencode/opencode.go`
  - `ListModels()` runs `opencode models`
  - returns `ModelRef` entries with IDs like `opencode/<provider>/<model>`
- `apps/runner-go/internal/adapters/codex/codex.go`
  - `ListModels()` returns a configured Codex fallback
- `apps/runner-go/cmd/fusion-runner/main.go`
  - `buildDiscoveryReport()` collects models
  - `registrationPayload()` sends `models` to the API

The web UI changes already started the desired experience:

- `/chat` fetches `/api/models` and `/api/runners`.
- `TaskConsole` has a multi-model panel picker.
- It has separate judge and final model pickers.
- It includes suggested MiniMax, DeepSeek, Kimi, OpenAI, Codex options.
- It sends `analysisModels`, `judgeModel`, and `finalModel`.
- `/runners` now shows local agents and detected model counts.

The core selector already started the right behavior:

- `packages/core/src/models/selection.ts`
  - accepts `requestedJudgeModel`
  - accepts `requestedFinalModel`
  - synthesizes unlisted custom models
  - supports manual provider policy

OpenAI-compatible route support has also started:

- `workers/api/src/routes/openai-compatible.ts`
  - accepts `fusion.analysis_models`
  - accepts `fusion.judge_model`
  - accepts `fusion.final_model`

### Not Fully Implemented

The main missing pieces are:

- Robust executable resolution like OpenDesign.
- OpenCode `opencode-cli` preference.
- `CODEX_BIN` / `OPENCODE_BIN` style overrides.
- Safe custom model ID validation.
- Prompt delivery through stdin in the Go runner.
- OpenCode JSON output mode.
- Codex JSON output mode.
- Runner job polling/execution loop for cloud-dispatched panel/judge/final jobs.
- Worker-side run planner that dispatches jobs to `RunnerSessionDO`.
- Persistence of panel/judge/final outputs.
- UI persistence for selected models.
- Connection/smoke tests for selected agent/model.

## Recommended Architecture

Fusion Harness should use this flow:

```text
fusion-runner discover/serve
  -> detect tools and models locally
  -> register runner with tools + models
  -> API stores tools/models in D1

Web /chat
  -> GET /api/models
  -> GET /api/runners
  -> user selects analysis models, judge model, final model
  -> POST /api/fusion-runs

API
  -> validate request
  -> list available models
  -> buildFusionExecutionPlan()
  -> dispatch panel jobs to RunnerSessionDO
  -> stream progress through FusionRunDO

Local runner
  -> poll /jobs/next
  -> run opencode/codex adapter with selected model
  -> send panel output events
  -> after panel jobs, API/runner runs judge
  -> after judge, API/runner runs final writer
  -> upload/store artifacts
```

## Implementation Plan

### Phase 1: Harden Local CLI Detection

Target files:

- `apps/runner-go/internal/discovery/discovery.go`
- `apps/runner-go/internal/adapters/opencode/opencode.go`
- `apps/runner-go/internal/adapters/codex/codex.go`
- `apps/runner-go/internal/config/config.go`

Implement an OpenDesign-style resolver:

- Support primary binary and fallback binaries.
- Support absolute binary overrides:
  - `OPENCODE_BIN`
  - `CODEX_BIN`
- Prefer `opencode-cli`, then fallback to `opencode`.
- Continue supporting normal `PATH` discovery.
- Add common user toolchain dirs for GUI-launched apps:
  - `$HOME/.local/bin`
  - `$HOME/.npm-global/bin`
  - `$HOME/.bun/bin`
  - `$HOME/.cargo/bin`
  - Homebrew paths on macOS
  - optional `FH_AGENT_HOME` or config-level extra tool dirs

OpenCode current issue:

```go
discovery.DetectCommandWithVersion(ctx, "opencode", "--version")
```

Recommended:

```text
resolve opencode-cli first
fallback opencode
store selected path in ToolRef.path
```

Codex current issue:

```go
discovery.DetectCommandWithVersion(ctx, "codex", "--version")
```

Recommended:

```text
allow CODEX_BIN absolute override
fallback to PATH codex
report override diagnostics in metadata
```

### Phase 2: Improve Model Discovery

Target files:

- `apps/runner-go/internal/adapters/opencode/opencode.go`
- `apps/runner-go/internal/adapters/codex/codex.go`
- `apps/runner-go/internal/adapters/adapters.go`
- `packages/shared/src/types.ts`

OpenCode should run:

```text
opencode-cli models
```

Fallback models should include at least:

- `anthropic/claude-sonnet-4-5`
- `openai/gpt-5`
- `google/gemini-2.5-pro`
- user-requested suggestions:
  - `minimax/minimax-m1`
  - `deepseek/deepseek-chat`
  - `moonshotai/kimi-k2`

Codex fallback models should be expanded to match OpenDesign:

- `gpt-5.5`
- `gpt-5.4`
- `gpt-5.4-mini`
- `gpt-5.3-codex`
- `gpt-5.1`
- `gpt-5.1-codex-mini`
- `gpt-5-codex`
- `gpt-5`
- `o3`
- `o4-mini`

Recommended metadata addition:

```ts
source?: "live" | "fallback" | "suggested" | "custom";
```

This is optional, because `availability` already carries some meaning, but source metadata will make UI badges and debugging clearer.

### Phase 3: Add Safe Custom Model Validation

Target files:

- `packages/shared/src/zod.ts`
- `packages/core/src/models/selection.ts`
- `apps/web/src/app/chat/task-console.tsx`

OpenDesign validates custom models with a strict allowlist. Fusion Harness currently synthesizes models from any trimmed string:

```ts
return synthesizeModel(normalized, fallbackAdapter);
```

This should be guarded. Add a shared helper:

```ts
export function sanitizeCustomModelId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(trimmed)) return null;
  return trimmed;
}
```

Use it in:

- request schema preprocessing
- `resolveRequestedModel(...)`
- web custom model submit

This prevents values like `--dangerous-flag` from becoming synthetic model IDs.

### Phase 4: Send Prompts Through Stdin

Target files:

- `apps/runner-go/internal/executors/host/host.go`
- `apps/runner-go/internal/adapters/opencode/opencode.go`
- `apps/runner-go/internal/adapters/codex/codex.go`

Current adapters append prompt text as argv:

```go
args = append(args, input.Prompt)
```

This is fragile for long prompts and diverges from OpenDesign.

Add stdin support to `host.CommandSpec`:

```go
type CommandSpec struct {
  Name string
  Args []string
  Stdin string
  ...
}
```

Then run OpenCode as:

```text
opencode-cli run --format json --dangerously-skip-permissions --model <model> -
```

And write the prompt to stdin.

Run Codex as:

```text
codex exec --json --skip-git-repo-check --sandbox <policy> --model <model>
```

And write the prompt to stdin.

Do not add a literal `-` to Codex argv unless the installed Codex CLI explicitly supports it. OpenDesign avoids it because current Codex builds reject that sentinel.

### Phase 5: Parse Structured Agent Streams

Target files:

- `apps/runner-go/internal/adapters/opencode/opencode.go`
- `apps/runner-go/internal/adapters/codex/codex.go`
- new parser package, for example:
  - `apps/runner-go/internal/streams/opencode.go`
  - `apps/runner-go/internal/streams/codex.go`

The runner should convert structured JSON events to Fusion Harness events:

- `panel.job.started`
- `panel.output.delta`
- `panel.tool.started`
- `panel.tool.completed`
- `panel.job.completed`
- `panel.job.failed`
- `judge.started`
- `judge.completed`
- `final.started`
- `final.completed`

At minimum:

- treat JSON error frames as failed jobs
- collect assistant text
- preserve stderr tail for failure detail
- keep raw JSON in logs/artifacts when useful

### Phase 6: Dispatch Planned Jobs to Runners

Target files:

- `workers/api/src/services/runs.ts`
- `workers/api/src/durable-objects/FusionRunDO.ts`
- `workers/api/src/durable-objects/RunnerSessionDO.ts`
- `workers/api/src/routes/fusion-runs.ts`
- `packages/core/src/fusion/orchestrator.ts`

Current state:

- `createRunFromRequest(...)` stores the request and notifies `FusionRunDO`.
- `FusionRunDO` records the start event.
- `RunnerSessionDO` can queue jobs.
- There is no complete planner-to-runner dispatch path yet.

Recommended implementation:

1. In `createRunFromRequest(...)`, after storing the prompt:
   - call `listModels(...)`
   - call `buildFusionExecutionPlan(payload, models)`
   - persist plan artifact
   - choose a runner that has required adapter(s)
   - dispatch panel jobs to `RunnerSessionDO`

2. Add runner job payload:

```ts
type RunnerJob = {
  id: string;
  runId: string;
  kind: "panel" | "judge" | "final";
  model: ModelRef;
  prompt: string;
  permissionProfile: PermissionProfile;
  workspaceId?: string;
};
```

3. Extend local runner `serve`:
   - poll `/api/runners/:id/jobs/next` or a runner-session route
   - run the matching adapter
   - POST events to `/api/fusion-runs/:id/runner-event` or `FusionRunDO`
   - upload outputs/artifacts

4. Add orchestration dependency:
   - judge waits for panel outputs
   - final waits for judge output

The current Worker can enqueue jobs, but the local runner does not yet consume and execute cloud jobs. That is the critical feature completion point.

### Phase 7: Persist Panel, Judge, and Final Outputs

Target files:

- `packages/db/src/queries.ts`
- `packages/db/src/schema.ts`
- `workers/api/src/services/runs.ts`
- `workers/api/src/durable-objects/FusionRunDO.ts`

Use existing tables:

- `panel_outputs`
- `artifacts`
- `fusion_runs.judge_object_key`
- `fusion_runs.final_object_key`

Required behavior:

- create one `panel_outputs` row per panel job
- store raw panel output as R2 artifact
- store judge JSON as R2 artifact and set `judge_object_key`
- store final response as R2 artifact and set `final_object_key`
- mark run `completed` only after final output exists
- mark run `failed` if required panel/judge/final step fails and no fallback is available

### Phase 8: Improve UI Persistence and UX

Target files:

- `apps/web/src/app/chat/task-console.tsx`
- possibly `apps/web/src/stores/ui-store.ts`

Current UI state is local to `TaskConsole`. Add persistence for:

- selected analysis model IDs
- selected judge model
- selected final model
- selected preset
- permission profile

Simple first step:

```text
localStorage key: fusion-harness:model-selection
```

Better later:

```text
user preferences table / API
```

Also add:

- model source badges: detected, suggested, custom
- "untested" label for custom models
- disabled state when no local runner can serve the adapter
- "Rescan models" action that runs model discovery on the active runner
- model-not-found recovery when a run fails

### Phase 9: Add Smoke Tests

Target files:

- `apps/runner-go/internal/discovery/discovery_test.go`
- `apps/runner-go/internal/adapters/opencode`
- `apps/runner-go/internal/adapters/codex`
- `packages/core/src/models/selection.test.ts`
- `workers/api` route tests if available
- `apps/web` component tests if available

Test cases:

- OpenCode prefers `opencode-cli` over `opencode`.
- OpenCode parses provider/model lines.
- OpenCode falls back to configured models when listing fails.
- Codex exposes the expanded fallback list.
- Custom model sanitizer rejects:
  - empty string
  - whitespace
  - `--flag`
  - strings over 200 chars
  - control characters
- `selectFusionModels` honors requested judge/final models.
- Synthetic custom model chooses:
  - `opencode` for slash-style provider models
  - `codex` for bare OpenAI/Codex model IDs when appropriate
- `/api/models` returns runner-registered models.
- OpenAI-compatible route accepts `fusion.judge_model` and `fusion.final_model`.

## Specific Code Notes

### OpenCode Adapter

Current:

```go
tool := discovery.DetectCommandWithVersion(ctx, "opencode", "--version")
```

Recommended:

```text
Detect opencode-cli first.
Fallback to opencode.
Use selected path for both `models` and `run`.
```

Current run command:

```go
args := []string{"run"}
if input.Model != "" {
  args = append(args, "--model", input.Model)
}
args = append(args, input.Prompt)
```

Recommended:

```text
run --format json --dangerously-skip-permissions --model <model> -
stdin = prompt
```

### Codex Adapter

Current fallback:

```go
codex/gpt-5-codex
```

Recommended: expand to the OpenDesign fallback list and include `default` semantics internally.

Current run command:

```go
codex exec --sandbox <policy> --model <model> <prompt>
```

Recommended:

```text
codex exec --json --skip-git-repo-check --sandbox <policy> --model <model>
stdin = prompt
```

Add future support for reasoning effort if Fusion Harness wants Codex reasoning selection:

```text
-c model_reasoning_effort="<low|medium|high|xhigh>"
```

### Core Model Selection

Current `synthesizeModel(...)` is useful but too permissive. Add model ID sanitation before synthesis.

Also consider passing selected judge/final even if they are not part of the panel. This is already supported by the new override fields. Keep it: judge/final should be able to use a high-quality model while panel models are cheaper or more diverse.

### API Routes

`/api/models/discover` currently creates only an audit event. It should become useful:

Option A:

- mark discovery requested
- runner picks up a discovery job
- runner re-registers with fresh models

Option B:

- API dispatches a `command` job to selected runner
- runner returns fresh model list
- API updates `models`

Option A is simpler and matches the existing registration model.

### OpenAI-Compatible API

The route now supports:

```json
{
  "fusion": {
    "analysis_models": ["opencode/minimax/minimax-m1"],
    "judge_model": "codex/gpt-5.5",
    "final_model": "codex/gpt-5-codex"
  }
}
```

Keep this shape. It maps well to OpenRouter-style clients while keeping Fusion Harness semantics explicit.

## Proposed Milestone Order

1. Finish runner discovery parity:
   - `opencode-cli` preference
   - binary overrides
   - expanded fallback models
   - model sanitizer

2. Finish adapter execution parity:
   - stdin prompt support
   - JSON output flags
   - structured error detection

3. Finish cloud dispatch:
   - build plan from selected models
   - enqueue jobs
   - runner polls jobs
   - events stream to `FusionRunDO`

4. Finish persistence:
   - panel outputs
   - judge artifact
   - final artifact
   - status transitions

5. Finish UI:
   - persist model choices
   - rescan models
   - show detected/suggested/custom source
   - show model test failures clearly

6. Add tests:
   - runner adapter tests
   - model selection tests
   - API route tests
   - UI picker tests

## Risks

Custom model IDs currently become executable argv values. They are not shell-interpolated, but they still need validation so a downstream CLI does not treat them as flags.

OpenCode Desktop can install a GUI `opencode` binary. Fusion Harness should prefer `opencode-cli` to avoid spawning a GUI launcher.

Prompt-in-argv will break for long design/fusion prompts. Stdin support should be treated as required, not optional.

`configured_unverified` models are useful for new models, but the UI should make clear they may fail until tested.

The current UI can submit suggested models that are not registered in `/api/models`. That is fine if synthesis is intentional, but it must be sanitized and surfaced as custom/suggested.

The current Worker does not execute the full fusion plan. Without runner job dispatch, the feature is mostly a planning/UI layer.

## Acceptance Criteria

The feature is complete when:

- Runners show OpenCode/Codex detected status and version.
- `/api/models` returns OpenCode-listed models after `fusion-runner serve --once`.
- The chat page can pick MiniMax, DeepSeek, Kimi, Codex, and custom IDs.
- Selected `analysisModels`, `judgeModel`, and `finalModel` are preserved in the request.
- The core planner builds panel, judge, and final steps using those exact selections.
- The API dispatches those steps to a runner.
- The runner executes OpenCode/Codex with the selected model via stdin.
- Structured errors mark jobs/runs failed.
- Panel, judge, and final outputs are persisted.
- The run events page shows the full lifecycle.

## Bottom Line

Fusion Harness is already close at the contract, DB, and UI layers. The next implementation work should focus on runner parity and dispatch:

- make local agent/model discovery as robust as OpenDesign
- validate custom model IDs
- execute prompts through stdin
- wire the selected model plan into real runner jobs
- persist and stream the resulting panel/judge/final outputs

That will turn the current model picker UI from a front-end selection surface into a working OpenDesign-style local-agent fusion pipeline.
