# Local Agents and Model Selection Report

## Scope

This report documents how Open Design detects locally installed code-agent CLIs, how it exposes agent-specific model choices, how selected models are persisted, and how those choices are used during generation.

Analyzed repository: `/Users/vijay/Documents/Development/Tools/open-design`

Primary files reviewed:

- `apps/daemon/src/agents.ts`
- `apps/daemon/src/server.ts`
- `apps/daemon/src/app-config.ts`
- `apps/daemon/src/connectionTest.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/providers/registry.ts`
- `apps/web/src/providers/daemon.ts`
- `apps/web/src/components/SettingsDialog.tsx`
- `apps/web/src/components/AvatarMenu.tsx`
- `apps/web/src/components/AgentPicker.tsx`
- `apps/web/src/components/modelOptions.tsx`
- `packages/contracts/src/api/registry.ts`
- `packages/contracts/src/api/chat.ts`
- `docs/agent-adapters.md`

## Executive Summary

Open Design already has a local-agent abstraction. The daemon owns detection, model discovery, model validation, CLI spawning, and stream parsing. The web app fetches detected agents through `/api/agents`, stores the active agent and per-agent model choice in app config, then sends `agentId`, `model`, and `reasoning` with each run.

The important distinction is that models are selected inside a selected agent adapter. OpenCode models are OpenCode model IDs, usually `provider/model`. Codex models are Codex CLI model IDs. The current system does not let the user choose an OpenCode model while running Codex, or vice versa.

OpenCode is the strongest path for selecting many provider-qualified model IDs such as MiniMax, DeepSeek, Kimi, OpenAI, Google, Anthropic, and others, because the adapter runs `opencode models` and groups `provider/model` IDs in the UI. Codex does not expose a model-list command in this app, so the Codex picker uses a curated fallback list plus a custom-model input.

There is no OpenRouter-style "model fusion" or separate visible "judge model" selector in this repo. The app runs one active local agent per manual chat/routine/orbit run. Critique Theater exists as a hidden/default-disabled orchestrator path, but it is gated by environment config and plain stream adapters; it is not exposed as a local-agent judge-model picker.

## End-to-End Flow

```text
Web boot/settings
  -> fetch /api/agents
  -> daemon detectAgents()
  -> daemon probes local CLIs and model lists
  -> web shows agent cards and model dropdowns
  -> user selects agent/model/reasoning
  -> web persists to localStorage and PUT /api/app-config

Manual chat
  -> web streamViaDaemon()
  -> POST /api/runs with agentId, model, reasoning
  -> daemon startChatRun()
  -> validate selected model/reasoning
  -> resolve selected agent executable
  -> build CLI argv with selected model
  -> spawn local CLI
  -> parse agent stream
  -> emit run events back to UI
```

## Agent Detection

Agent detection lives in `apps/daemon/src/agents.ts`.

The central registry is `AGENT_DEFS`. Each entry describes:

- `id`, `name`, `bin`, and optional `fallbackBins`
- version probe args
- static `fallbackModels`
- optional dynamic `listModels` or `fetchModels`
- optional `reasoningOptions`
- `buildArgs(...)`, which maps the selected model/reasoning into CLI argv
- `promptViaStdin`, `streamFormat`, and `eventParser`

The daemon exposes this through `GET /api/agents` in `apps/daemon/src/server.ts`. That route reads persisted app config, passes saved per-agent CLI env overrides into `detectAgents(...)`, and returns an `AgentInfo[]` payload. The contract is defined in `packages/contracts/src/api/registry.ts`.

Detection is executable-centric:

- It first checks configured absolute binary overrides such as `CODEX_BIN` or `OPENCODE_BIN`.
- It then searches `PATH`.
- It also adds common user toolchain directories from `wellKnownUserToolchainBins(...)`, which helps GUI-launched desktop apps find shell-installed CLIs.
- It tries `def.bin` first, then each `fallbackBins` entry.
- If no binary is found, the agent is returned with `available: false`, install/docs links, and fallback model hints.
- If a binary is found, the agent is marked available even when the version probe fails.
- If the agent has dynamic model discovery, the daemon runs it best-effort with a timeout. On failure, it falls back to static model hints.

The saved CLI env allowlist lives in `apps/daemon/src/app-config.ts`. Relevant supported overrides include:

- Codex: `CODEX_HOME`, `CODEX_BIN`
- OpenCode: `OPENCODE_BIN`
- Claude: `CLAUDE_CONFIG_DIR`, `CLAUDE_BIN`
- Gemini: `GEMINI_BIN`
- Kimi: `KIMI_BIN`
- DeepSeek: `DEEPSEEK_BIN`
- Qoder: `QODER_BIN`
- Qwen: `QWEN_BIN`
- Cursor Agent: `CURSOR_AGENT_BIN`
- Copilot: `COPILOT_BIN`

`SettingsDialog` surfaces these fields under Local CLI env settings and the rescan path passes pending env values back through `/api/agents`.

## Model Discovery

The daemon supports three model-list sources:

1. `fallbackModels`: static model hints declared in `AGENT_DEFS`.
2. `listModels`: a CLI command whose stdout is parsed into model options.
3. `fetchModels`: a custom async model detector, used by ACP/RPC-style agents.

Every picker includes a synthetic `default` model option. `default` means "do not pass a model flag; let the CLI's own local config decide."

The most important agent-specific behavior:

### OpenCode

OpenCode is defined with:

- primary binary: `opencode-cli`
- fallback binary: `opencode`
- dynamic model listing: `opencode-cli models`
- parser: line-separated model IDs
- fallback model hints:
  - `default`
  - `anthropic/claude-sonnet-4-5`
  - `openai/gpt-5`
  - `google/gemini-2.5-pro`

The app deliberately prefers `opencode-cli` because OpenCode Desktop may install both `opencode` and `opencode-cli`; the bare `opencode` can be a GUI launcher, not a stdin-driven CLI.

When the user chooses an OpenCode model, generation uses:

```text
opencode-cli run --format json --dangerously-skip-permissions --model <model-id> -
```

The prompt is written through stdin.

This is the adapter most aligned with selecting provider-specific models like:

- `openai/gpt-5`
- `anthropic/claude-sonnet-4-5`
- `google/gemini-2.5-pro`
- provider-qualified MiniMax, DeepSeek, Kimi, and similar IDs if `opencode models` returns them

The UI groups slash-separated IDs by provider using `apps/web/src/components/modelOptions.tsx`, so large OpenCode model lists become provider optgroups.

### Codex

Codex is defined with:

- binary: `codex`
- no dynamic model-list command
- static fallback model hints:
  - `default`
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
- reasoning options:
  - `default`
  - `none`
  - `minimal`
  - `low`
  - `medium`
  - `high`
  - `xhigh`

When the user chooses a Codex model, generation uses:

```text
codex exec --json --skip-git-repo-check --sandbox workspace-write \
  -c sandbox_workspace_write.network_access=true \
  -C <project-cwd> \
  --model <model-id> \
  -c model_reasoning_effort="<effort>"
```

The prompt is written through stdin. Codex intentionally does not pass a literal `-` stdin sentinel because recent Codex CLI versions reject it.

Codex reasoning is clamped for some model families before sending it to the CLI. For example, newer GPT-5.5-family models reject `minimal`, so the daemon clamps that to `low`.

### ACP and Pi-Style Agents

Some agents use richer session protocols rather than plain CLI output:

- Hermes and Kimi use ACP JSON-RPC.
- Pi uses its own RPC mode.
- Devin/Kiro/Kilo/Vibe have ACP-style entries.

For these, model discovery can come from `detectAcpModels(...)` or `parsePiModels(...)`. During generation, selected models are passed into the ACP/Pi session layer instead of a simple stdout parser.

### Other Static or Semi-Dynamic Agents

Gemini, Qoder, Qwen, Copilot, Cursor Agent, Claude, DeepSeek, and others have their own `AGENT_DEFS` entries. Some expose model list commands; others use static fallback hints and custom IDs.

## UI Model Selection

Model selection appears in two places:

- Settings -> Local CLI, implemented in `apps/web/src/components/SettingsDialog.tsx`
- Avatar menu quick selector, implemented in `apps/web/src/components/AvatarMenu.tsx`

The top-level agent picker in `apps/web/src/components/AgentPicker.tsx` chooses the active agent, not the model.

The Settings dialog flow is:

1. Show available and unavailable agents from `/api/agents`.
2. User selects one available agent card.
3. If the selected agent exposes `models`, show a model dropdown.
4. If the selected agent exposes `reasoningOptions`, show a reasoning dropdown.
5. Always allow "Custom..." when a model list exists.
6. Persist the choice as `agentModels[agentId] = { model, reasoning }`.

The model option helper in `modelOptions.tsx`:

- pins `default` first
- groups slash-separated IDs as `<optgroup label="provider">`
- keeps custom selected IDs visible in the avatar menu when they are not in the current model list

Custom model behavior is important for newer models. If a user wants a model ID that is not in the current list, Settings can store it as long as the daemon accepts the custom ID format later.

## Persistence

There are two persistence layers:

- Browser `localStorage` through `apps/web/src/state/config.ts`
- Daemon `app-config.json` through `apps/daemon/src/app-config.ts`

Daemon-owned preferences include:

```ts
agentId?: string | null;
agentModels?: Record<string, { model?: string; reasoning?: string }>;
agentCliEnv?: Record<string, Record<string, string>>;
```

`App.tsx` keeps these in sync:

- `handleAgentChange(agentId)` stores the active agent.
- `handleAgentModelChange(agentId, choice)` merges a model/reasoning choice into that agent's slot.
- `refreshAgents(...)` can first persist pending CLI env values, then refetch `/api/agents`.
- On boot, if no agent is configured, the app auto-picks the first available detected agent after daemon config and agent detection have loaded.

This means switching between Codex and OpenCode does not destroy each agent's model choice. Each agent keeps its own `agentModels[agentId]` entry.

## Generation Path

Manual chat uses `apps/web/src/providers/daemon.ts`:

- The frontend collapses chat history into a single prompt string.
- It sends a `ChatRequest` to `POST /api/runs`.
- The request includes `agentId`, `model`, and `reasoning`.
- It then streams events from `/api/runs/:id/events`.

The same daemon implementation is also used by legacy/direct `POST /api/chat`.

Generation is handled by `startChatRun(...)` in `apps/daemon/src/server.ts`:

1. Validate the agent ID with `getAgentDef(agentId)`.
2. Compose the daemon system prompt from the selected skill, design system, project metadata, and runtime tool contract.
3. Stage the active skill directory into the project when needed.
4. Resolve extra allowed dirs for agents that support path allowlists.
5. Validate the selected model:
   - accept if it matches the latest live model list from `/api/agents`
   - accept if it matches static fallback models
   - otherwise pass it through `sanitizeCustomModel(...)`
6. Validate selected reasoning against `def.reasoningOptions`.
7. Resolve the agent binary with saved CLI env overrides.
8. Call `def.buildArgs(...)` with `{ model, reasoning }`.
9. Spawn the CLI with `createCommandInvocation(...)`.
10. Write the prompt to stdin when `promptViaStdin` is true.
11. Parse stdout based on `streamFormat` and `eventParser`.
12. Emit typed events back to the web UI.

The selected model is also included in the `start` SSE payload:

```ts
{
  runId,
  agentId,
  bin,
  streamFormat,
  projectId,
  cwd,
  model: safeModel,
  reasoning: safeReasoning
}
```

## Stream and Result Parsing

Different agents produce different streams:

- Codex, OpenCode, and Gemini use `json-event-stream` with adapter-specific parsers.
- Claude uses `claude-stream-json`.
- Qoder uses `qoder-stream-json`.
- Copilot uses `copilot-stream-json`.
- ACP agents use an ACP JSON-RPC session.
- Pi uses a Pi RPC session.
- Plain agents stream raw stdout.

The daemon treats structured error frames as failures. For OpenCode, tests explicitly verify that a JSON error frame such as "model not found" marks the run failed even if the process exits with code 0.

## Connection Testing

Settings can test a selected local agent and model through `POST /api/test/connection` with `{ mode: "agent" }`.

That route:

- validates `agentId`
- validates/sanitizes the requested model
- validates reasoning against the agent's declared options
- calls `testAgentConnection(...)`

`testAgentConnection(...)` in `apps/daemon/src/connectionTest.ts`:

- resolves the selected binary
- builds argv with the selected model/reasoning
- spawns the CLI in a temporary directory
- sends a smoke prompt: `Reply with only: ok`
- parses the agent stream
- classifies model errors as `not_found_model`
- rejects invalid custom model IDs as `invalid_model_id`
- returns path diagnostics for Codex custom binary overrides

This is the correct built-in way to test whether a selected local agent/model can actually generate before sending a real design prompt.

## Validation and Safety

Model values are passed as child-process argv, not through a shell string. That already avoids shell injection.

The daemon still validates model IDs:

- Known model IDs from the last `/api/agents` result are accepted.
- Static fallback model IDs are accepted.
- Custom model IDs must:
  - be 1 to 200 characters
  - start with a letter or number
  - contain only letters, numbers, `.`, `_`, `/`, `:`, `@`, or `-`
  - contain no spaces or control characters
  - not start with `-`

Invalid custom IDs such as `--not-a-model` are rejected before the CLI is spawned.

Reasoning is stricter. It is accepted only when the agent declares `reasoningOptions` and the selected ID matches one of those options.

## How to Choose Models From Local Agents

For OpenCode:

1. Install/authenticate OpenCode so `opencode-cli` works from the shell.
2. Confirm `opencode-cli models` returns the provider/model IDs you expect.
3. Open Settings -> Local CLI.
4. Rescan agents.
5. Select OpenCode.
6. Pick a returned model from the grouped dropdown, or choose Custom and type a provider/model ID.
7. Use Test to verify the selected model.

For Codex:

1. Install/authenticate Codex so `codex --version` and `codex exec` work.
2. Open Settings -> Local CLI.
3. Select Codex.
4. Pick one of the static Codex model hints or choose Custom and type a valid Codex model ID.
5. Optionally choose a reasoning effort.
6. Use Test to verify the selected model.

For Kimi/Hermes/Pi/ACP-style agents:

1. Install and authenticate the CLI.
2. Rescan agents.
3. If the adapter can detect models through ACP/RPC, the picker will show them.
4. If not, use the static hints or Custom when the UI exposes model choices.

## Current Capability vs Requested Capability

Already implemented:

- Detect multiple local CLI agents.
- Show installed/uninstalled status.
- Show version/path when available.
- Provide install/docs links for missing agents.
- Select active local agent.
- Select per-agent model and reasoning.
- Store a separate model choice per agent.
- Test selected local agent/model.
- Run generation using the selected agent/model.
- Use OpenCode's own model listing for broad provider/model selection.
- Allow safe custom model IDs for models not returned by the CLI list.

Not currently implemented:

- Cross-agent model fusion.
- A separate judge model picker.
- Selecting an OpenCode-listed model while the active agent is Codex.
- Dynamic Codex model discovery from a `codex models` command.
- Rich auth/config-state detection before marking a binary available.
- A visible first-screen OpenRouter-style modal for comparing many models side by side.

## Important Gaps

The docs mention config-dir probing as a detection strategy, but the current implementation is primarily binary/path based plus configured env overrides. A binary can be marked available even if auth is missing; that failure appears during Test or generation.

Codex model options are static hints. If a newer Codex model exists but is not in the fallback list, users must use Custom.

OpenCode model lists depend on `opencode-cli models`. If that command fails, times out, or returns nothing, the app falls back to three static OpenCode hints.

Custom model validation proves the ID is syntactically safe, not that the provider account has access. Runtime or Test still has to confirm availability.

Reasoning options are currently per-agent and mostly Codex-specific. There is no general provider-agnostic reasoning schema.

## Recommended Improvements

1. Add model source metadata to `/api/agents`, for example `source: "live" | "fallback" | "custom"`, so the UI can distinguish live OpenCode results from static hints.
2. Add an explicit "Refresh models" action per selected agent, separate from full agent rescan.
3. Add auth-state checks where CLIs support them, so "Detected" can become "Detected, auth needed" instead of only "available".
4. Add a chat-surface model picker near the composer for faster switching, while preserving Settings as the full configuration surface.
5. Add Codex dynamic model discovery if the Codex CLI exposes a stable listing command in the future.
6. Add an optional judge/fusion config only if product direction requires multi-model deliberation. It should be separate from the active generation agent because current `agentModels[agentId]` means "model for this single agent run."
7. Persist the last connection-test result per agent/model so the UI can warn when a selected custom model has never been tested.
8. Add an explicit model-unavailable recovery path when a run fails with model-not-found, such as "open model picker" or "switch to default".

## Tests Reviewed

Relevant existing tests:

- `apps/daemon/tests/agents.test.ts`
  - pins Codex model list and reasoning options
  - verifies Codex passes `--model` and `model_reasoning_effort`
  - verifies Codex prompt is stdin-only
  - verifies OpenCode prefers `opencode-cli` over `opencode`
  - verifies binary override support
  - verifies adapter-specific model args for several agents

- `apps/daemon/tests/connection-test.test.ts`
  - verifies local-agent smoke tests
  - classifies model-not-found errors
  - rejects invalid custom model IDs before spawning
  - checks Codex executable override diagnostics

- `apps/web/tests/components/modelOptions.test.tsx`
  - verifies provider/model grouping
  - pins `default` first
  - detects custom model IDs

- `apps/web/tests/components/SettingsDialog.test.ts`
  - verifies custom model input remains visible while editing
  - verifies CLI env settings behavior
  - verifies rescan passes pending CLI env prefs

## File Map

`apps/daemon/src/agents.ts`
: Agent catalog, local binary resolution, model discovery, fallback model lists, model validation helpers, spawn env construction, and per-agent argv builders.

`apps/daemon/src/server.ts`
: `/api/agents`, `/api/app-config`, `/api/runs`, `/api/chat`, `/api/test/connection`, run orchestration, prompt composition, spawn path, stream parsing, and routine/orbit reuse of saved model prefs.

`apps/daemon/src/app-config.ts`
: Daemon-persisted preferences, allowed config keys, `agentModels`, and allowed `agentCliEnv` variables.

`apps/daemon/src/connectionTest.ts`
: Local-agent smoke-test implementation used by Settings.

`apps/web/src/App.tsx`
: App-level state, config sync, auto agent selection, agent/model change handlers, agent refresh.

`apps/web/src/components/SettingsDialog.tsx`
: Full Local CLI configuration UI, agent cards, model dropdown, custom model input, reasoning dropdown, CLI env fields, Test and Rescan actions.

`apps/web/src/components/AvatarMenu.tsx`
: Quick active-agent and active-model selector.

`apps/web/src/components/AgentPicker.tsx`
: Top-level mode and active-agent picker.

`apps/web/src/components/modelOptions.tsx`
: Shared model option rendering and custom-model detection.

`apps/web/src/providers/daemon.ts`
: Sends selected agent/model/reasoning to `POST /api/runs`.

`packages/contracts/src/api/registry.ts`
: API shape for detected agents and model options.

`packages/contracts/src/api/chat.ts`
: Chat/run request shape, including `agentId`, `model`, and `reasoning`.
