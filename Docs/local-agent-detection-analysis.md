# Local Agent Detection Analysis — openFusion vs Open Design

**Date:** 2026-06-21
**Scope:** Root-cause analysis of "fewer models in production than local" + upgrade roadmap
**Reference repo:** [nexu-io/open-design](https://github.com/nexu-io/open-design) (cloned at `/Users/vijay/Documents/Development/Tools/open-design`)
**Current repo:** openFusion (`/Users/vijay/Documents/Development/AsthriX/Fusion_Harness/fusion-harness`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem](#2-the-problem)
3. [Root Cause Analysis](#3-root-cause-analysis)
4. [Architecture Comparison](#4-architecture-comparison)
5. [Agent-by-Agent Model Listing Gap](#5-agent-by-agent-model-listing-gap)
6. [Pros and Cons of Current Setup](#6-pros-and-cons-of-current-setup)
7. [Should You Upgrade?](#7-should-you-upgrade)
8. [Recommended Upgrade Plan (Zero-Cost)](#8-recommended-upgrade-plan-zero-cost)
9. [Implementation Details](#9-implementation-details)
10. [Verification Checklist](#10-verification-checklist)

---

## 1. Executive Summary

The production model deficit has **three root causes**, ranked by impact:

| # | Root Cause | Impact | Fix Difficulty |
|---|---|---|---|
| 1 | **`FallbackModels` is dead code** — defined for all 23 agents but never referenced in `listModels()`. 19 of 23 agents only ever register a single `"default"` model. | Critical | Easy (1-line fix) |
| 2 | **Only 4 of 23 agents have live model listing** (`opencode`, `codex`, `cursor-agent`, `grok-build`). The other 19 have no `ListModelsArgs` and no `fetchModels` equivalent. | High | Medium |
| 3 | **Production D1 only has models if a runner is registered against the production API** and is online (heartbeat within 2 min). Local dev populates the dev D1 only. | High | Config/ops |

**Bottom line:** The current setup is **not fine** for production. It needs a targeted upgrade — but the upgrade is **zero-cost** (no paid APIs, no new infrastructure) and mostly involves wiring up existing dead code and porting proven patterns from open-design.

---

## 2. The Problem

> "In local I am getting all the models from the provider but in live production it is not showing full models."

### What happens locally (dev)

1. You run `fusion-runner serve` against `localhost:8787` (dev Worker).
2. The Go runner detects installed CLIs on your machine.
3. For `opencode` and `codex` (which you have installed + authenticated), `listLiveModels()` succeeds → full model list registered to dev D1.
4. The web app at `localhost:3000` calls `apiBaseUrl()` → returns `http://localhost:8787` → reads dev D1 → you see all models.

### What happens in production

1. The production web app at `fusion.asthrix.workers.dev` calls `apiBaseUrl()` → returns `https://fusion-api.asthrix.workers.dev` (production Worker).
2. Production D1 only has models if a runner has called `POST /api/runners/register` against the **production** API.
3. If no runner is registered against production → only the 6 hardcoded `local/*` aliases appear (`packages/db/src/queries.ts` / `workers/api/src/routes/models.ts:7-14`).
4. If a runner IS registered but the production runner host doesn't have the CLIs installed/authenticated → `listLiveModels()` fails → only `"default"` per agent.
5. If the runner goes offline (no heartbeat in 2 min) → all its models are marked `unavailable` (`packages/db/src/queries.ts:1217-1226`).

### The model count gap

| Scenario | Models shown |
|---|---|
| Local dev (CLIs installed + authed) | Full list from `opencode models` + `codex debug models` + 1 "default" per other agent |
| Production (no runner registered) | 6 hardcoded `local/*` aliases only |
| Production (runner registered, CLIs not authed) | 1 "default" per detected agent |
| Production (runner registered, CLIs authed) | Same as local dev |

---

## 3. Root Cause Analysis

### 3.1 `FallbackModels` is dead code (CRITICAL BUG)

**File:** `apps/runner-go/internal/localagents/catalog.go`

The `AgentDef` struct has a `FallbackModels` field (line 24), and all 23 catalog entries populate it (lines 44, 61, 79, 99, 108, ...). These contain real model IDs like:

```go
FallbackModels: models(
    "anthropic/claude-sonnet-4-5",
    "openai/gpt-5",
    "google/gemini-2.5-pro",
    "minimax/minimax-m1",
    "deepseek/deepseek-chat",
    "moonshotai/kimi-k2",
),
```

**But `listModels()` never reads it:**

```go
// catalog.go:356-376
func listModels(ctx context.Context, defs []AgentDef, allowedRoots []string, toolDirs []string) []adapters.ModelRef {
    models := make([]adapters.ModelRef, 0)
    for _, def := range defs {
        tool := detect(ctx, def, toolDirs)
        if !tool.Found {
            continue
        }
        source := "detected"
        options := []ModelOption{model("default", "Default (CLI config)")}  // ← only "default"
        if len(def.ListModelsArgs) > 0 {
            if liveOptions := listLiveModels(ctx, def, tool.Path, allowedRoots); len(liveOptions) > 0 {
                options = liveOptions
                source = "live"
            }
        }
        // ↑ When ListModelsArgs is empty OR live listing fails:
        //   options stays as [default]. def.FallbackModels is NEVER used.
        for _, option := range options {
            models = append(models, modelRef(def, option, source))
        }
    }
    return models
}
```

**Result:** 19 of 23 agents (those without `ListModelsArgs`) only ever register a single `"default"` model. The carefully-curated `FallbackModels` like `"sonnet-4"`, `"gpt-5"`, `"gemini-2.5-pro"` are never surfaced to the user.

**Compare to open-design** (`apps/daemon/src/runtimes/detection.ts:56-67, 81-83`): when `fetchModels`/`listModels` fails or returns empty, it falls back to `def.fallbackModels` with `modelsSource: 'fallback'`. The fallback list is a first-class citizen.

### 3.2 `Source` field hardcoded to `"live"` (DATA QUALITY BUG)

**File:** `apps/runner-go/internal/localagents/catalog.go:519`

```go
func modelRef(def AgentDef, option ModelOption, source string) adapters.ModelRef {
    // ...
    availability := "detected"
    if source == "live" {
        availability = "listed"
    }
    return adapters.ModelRef{
        // ...
        Availability: availability,  // ← correct: "detected" or "listed"
        Source:       "live",        // ← BUG: hardcoded, ignores `source` param
        // ...
    }
}
```

The `source` parameter is used for `availability` but ignored for `Source`. Every model is marked `Source: "live"` even when it's just a detected `"default"`. This means:
- The D1 `isUserVisibleModel` filter (`packages/db/src/queries.ts:1130-1133`) can't distinguish real live models from fallback defaults.
- The UI can't show "these are live-discovered, these are fallback hints."

### 3.3 Only 4 agents have live model listing

| Agent | `ListModelsArgs` | Live listing works? |
|---|---|---|
| opencode | `["models"]` | Yes |
| codex | `["debug", "models"]` | Yes |
| cursor-agent | `["models"]` | Yes |
| grok-build | `["models"]` | Yes |
| claude | _(none)_ | No — only "default" |
| gemini | _(none)_ | No |
| qwen | _(none)_ | No |
| copilot | _(none)_ | No |
| qoder | _(none)_ | No |
| aider | _(none)_ | No |
| deepseek | _(none)_ | No |
| kimi | _(none)_ | No |
| hermes | _(none)_ | No |
| pi | _(none)_ | No |
| devin | _(none)_ | No |
| amp | _(none)_ | No |
| kiro | _(none)_ | No |
| kilo | _(none)_ | No |
| vibe | _(none)_ | No |
| trae-cli | _(none)_ | No |
| codebuddy | _(none)_ | No |
| reasonix | _(none)_ | No |
| antigravity | _(none)_ | No |

**Compare to open-design:** 14 of 24 agents have live model fetching via three strategies:
1. `listModels` (declarative CLI subcommand) — 4 agents
2. `fetchModels` (custom async) — 6 agents (AMR, Pi, Claude, + 3 ACP)
3. `detectAcpModels` (ACP JSON-RPC handshake) — 9 agents (Hermes, Devin, Kimi, Kiro, Kilo, Vibe, Trae CLI, Reasonix, AMR)

openFusion has **no ACP support** and **no `fetchModels` equivalent**, so 19 agents are stuck with "default" only.

### 3.4 Production D1 is empty without a registered runner

**File:** `apps/web/src/lib/api.ts:15-26`

```ts
export function apiBaseUrl() {
  const configured = process.env.FUSION_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (!isLocalHost(hostname) && (!configured || isLocalApiBaseUrl(configured))) {
      return productionApiBaseUrl;  // "https://fusion-api.asthrix.workers.dev"
    }
  }
  return configured || localApiBaseUrl;  // "http://localhost:8787"
}
```

The web app always talks to the production API in production. Models in production D1 only exist if a runner has registered against the production API with a models payload. If you only run the runner locally against `localhost:8787`, production D1 has zero discovered models.

### 3.5 Runner offline → models marked unavailable

**File:** `packages/db/src/queries.ts:1217-1226`

If a registered runner doesn't send a heartbeat within 2 minutes, `effectiveRunnerStatus` returns `"offline"`, and all models bound to that runner are marked `availability: "unavailable"`. They still appear in the list but are greyed out / unselectable.

### 3.6 Only opencode and codex can actually execute

**File:** `apps/runner-go/cmd/fusion-runner/main.go:441-453`

```go
func adapterForCloudJob(adapterId string) (adapters.Adapter, error) {
    switch adapterId {
    case "opencode":
        return opencode.New(), nil
    case "codex":
        return codex.New(), nil
    default:
        return nil, fmt.Errorf("adapter %q is not supported for cloud-dispatched runs", adapterId)
    }
}
```

Even if all 23 agents are detected with full model lists, only `opencode` and `codex` can actually run cloud-dispatched jobs. The other 21 are detect-only.

---

## 4. Architecture Comparison

### 4.1 High-level architecture

| Aspect | Open Design | openFusion |
|---|---|---|
| Language | TypeScript (Node daemon) | Go (runner) + TypeScript (Worker) |
| Detection location | Local daemon process | Go runner process |
| Model storage | In-memory (daemon) | D1 database (cloud) |
| Model delivery to UI | HTTP `/api/agents` + SSE stream | HTTP `/api/models` (reads D1) |
| Local dev vs prod | Same daemon, different config | Runner must register against correct API |
| Plugin system | `local-profiles.ts` (JSON file) + plugin runtime | None |
| ACP support | Yes (9 agents) | No |
| Streaming detection | Yes (SSE, incremental) | No (batch) |

### 4.2 Detection strategy comparison

| Strategy | Open Design | openFusion |
|---|---|---|
| Env override (`*_BIN`) | Yes (21 agents) | Yes (23 agents) |
| `exec.LookPath` / PATH | Yes | Yes |
| Well-known toolchain dirs | **~25 dirs** (Homebrew, nvm, fnm, mise, asdf, volta, bun, cargo, pnpm, etc.) | **4 dirs** (`.local/bin`, `.npm-global/bin`, `.bun/bin`, `.cargo/bin`) + Homebrew on macOS |
| Bundled binary fallback | Yes (AMR/vela) | No |
| Codex native binary upgrade | Yes (walks up from node wrapper to native binary) | No |
| Version probing | Yes (`--version` with failure classification) | Yes (`--version`, 3s timeout) |
| Capability probing | Yes (`--help` substring matching) | No |
| Auth status probing | Yes (`claude auth status`, `codex login status`, etc.) | No |
| GUI-launch PATH hardening | Yes (extensive) | Minimal |

### 4.3 Model fetching strategy comparison

| Strategy | Open Design | openFusion |
|---|---|---|
| `listModels` (CLI subcommand) | 4 agents | 4 agents |
| `fetchModels` (custom async) | 6 agents (AMR, Pi, Claude, + ACP) | 0 agents |
| `detectAcpModels` (ACP JSON-RPC) | 9 agents | 0 agents |
| `fallbackModels` (static hints) | All 24 agents (used as fallback) | All 23 agents (**DEAD CODE — never used**) |
| Provider API (`/v1/models`) | Yes (BYOK path) | No (models come from runner only) |

### 4.4 Toolchain directory coverage

**Open Design** (`packages/platform/src/index.ts:895` — `wellKnownUserToolchainBins()`):
```
~/.local/bin, ~/.vite-plus/bin, ~/.kimi-code/bin, ~/.opencode/bin,
~/.bun/bin, ~/.volta/bin, ~/.asdf/shims, ~/Library/pnpm, ~/.cargo/bin,
~/.npm-global/bin, ~/.npm-packages/bin, ~/.deno/bin, ~/go/bin,
~/.pyenv/shims, ~/scoop/shims (Windows), %APPDATA%/npm (Windows),
~/.local/share/mise/shims, ~/.mise/shims,
/opt/homebrew/bin, /usr/local/bin,
+ per-version Node bin dirs from nvm / fnm / mise installs
```
Also respects `VP_HOME`, `NPM_CONFIG_PREFIX`, `MISE_DATA_DIR`, `FNM_DIR` env overrides. 5-second TTL cache.

**openFusion** (`apps/runner-go/internal/discovery/discovery.go:103-121`):
```go
~/.local/bin, ~/.npm-global/bin, ~/.bun/bin, ~/.cargo/bin
$FH_AGENT_HOME, $FH_AGENT_HOME/bin
/opt/homebrew/bin, /usr/local/bin  (macOS only)
```

**Missing in openFusion:** `~/.volta/bin`, `~/.asdf/shims`, `~/Library/pnpm`, `~/.npm-packages/bin`, `~/.deno/bin`, `~/go/bin`, `~/.pyenv/shims`, `~/.local/share/mise/shims`, `~/.mise/shims`, nvm/fnm per-version dirs, `~/.opencode/bin`, `~/.kimi-code/bin`, `~/.vite-plus/bin`. No env override resolution for `NPM_CONFIG_PREFIX`, `MISE_DATA_DIR`, `FNM_DIR`.

**Impact:** If a user installed `opencode` via `pnpm` (lands in `~/Library/pnpm`) or `kimi` via its installer (lands in `~/.kimi-code/bin`), openFusion won't find it. Open Design will.

---

## 5. Agent-by-Agent Model Listing Gap

| Agent | Open Design live listing | openFusion live listing | Gap |
|---|---|---|---|
| opencode | `listModels: ["models"]` | `ListModelsArgs: ["models"]` | None |
| codex | `listModels: ["debug", "models"]` | `ListModelsArgs: ["debug", "models"]` | None |
| cursor-agent | `listModels: ["models"]` | `ListModelsArgs: ["models"]` | None |
| grok-build | `listModels: ["models"]` | `ListModelsArgs: ["models"]` | None |
| claude | `fetchModels: loadMmdRouteModels()` | _(none)_ | **No live listing** |
| gemini | `fallbackModels` only | _(none)_ | **No live listing** |
| qwen | `fallbackModels` only | _(none)_ | **No live listing** |
| copilot | `fallbackModels` only | _(none)_ | **No live listing** |
| qoder | `fallbackModels` only | _(none)_ | **No live listing** |
| aider | `fallbackModels` only | _(none)_ | **No live listing** |
| deepseek | `fallbackModels` only | _(none)_ | **No live listing** |
| kimi | `detectAcpModels(["acp"])` | _(none)_ | **No ACP support** |
| hermes | `detectAcpModels(["acp", "--accept-hooks"])` | _(none)_ | **No ACP support** |
| devin | `detectAcpModels([..., "acp"])` | _(none)_ | **No ACP support** |
| pi | `fetchModels: pi --list-models` (stderr TSV) | _(none)_ | **No custom fetch** |
| amp | `fallbackModels` only | _(none)_ | **No live listing** |
| kiro | `detectAcpModels(["acp"])` | _(none)_ | **No ACP support** |
| kilo | `detectAcpModels(["acp"])` | _(none)_ | **No ACP support** |
| vibe | `detectAcpModels(["acp"])` | _(none)_ | **No ACP support** |
| trae-cli | `detectAcpModels(["acp", "serve"])` | _(none)_ | **No ACP support** |
| codebuddy | `fallbackModels` only | _(none)_ | **No live listing** |
| reasonix | `detectAcpModels(["acp"])` | _(none)_ | **No ACP support** |
| antigravity | `fallbackModels` only | _(none)_ | **No live listing** |
| amr (vela) | `fetchModels: vela model list --format json` | _(not in catalog)_ | **Not supported** |

**Summary:** 14 of 24 open-design agents have live model fetching. 4 of 23 openfusion agents have live model fetching. 10 agents could gain live listing via ACP support alone.

---

## 6. Pros and Cons of Current Setup

### Pros

| Pro | Detail |
|---|---|
| **Clean two-plane architecture** | Cloudflare control plane (decide) + Go runner (execute). Detection stays local, cloud stays stateless. Well-documented in `AGENT.md`. |
| **D1-backed model registry** | Models persist across runner restarts. Dedup, availability scoring, org-scoping all handled in `packages/db/src/queries.ts`. |
| **OpenAI-compatible API** | `GET /v1/models` returns models in OpenAI format, enabling drop-in compatibility. |
| **MCP tool** | `fusion.list_models` exposes models to MCP clients. |
| **23-agent catalog** | Broad CLI coverage matching open-design's 24 agents. |
| **Env override support** | `*_BIN` env vars for all 23 agents, matching open-design. |
| **Neutral probe workspace** | `neutralProbeWorkspace()` runs model listing in a temp dir to avoid corrupting the cwd (learned from open-design's OpenCode/bun issue). |
| **Go performance** | Go runner is fast, single-binary, no Node runtime needed on the host. |
| **Docker support** | Host and docker executors available. |

### Cons

| Con | Impact | Severity |
|---|---|---|
| **`FallbackModels` is dead code** | 19 agents only show "default" | **Critical** |
| **`Source` hardcoded to `"live"`** | Can't distinguish real live models from fallback defaults | **High** |
| **No ACP support** | 9 agents can't list models (kimi, hermes, devin, kiro, kilo, vibe, trae-cli, reasonix, amr) | **High** |
| **No `fetchModels` equivalent** | Can't add custom async model fetching (needed for claude, pi, amr) | **High** |
| **Only 4 agents have live listing** | 19 agents stuck with "default" | **High** |
| **Only opencode/codex can execute** | 21 agents are detect-only; models register but can't run | **High** |
| **Minimal toolchain dirs** | Misses CLIs installed via volta, asdf, pnpm, deno, go, pyenv, mise, nvm, fnm | **Medium** |
| **No Codex native binary upgrade** | Codex detection may fail from GUI-launched runners (node wrapper issue) | **Medium** |
| **No local agent plug system** | Can't add custom CLI wrappers without code changes (open-design has `agents.local.json`) | **Medium** |
| **No streaming detection** | UI waits for all probes to finish before showing anything | **Low** |
| **No capability probing** | Can't detect which CLI features are available (e.g., `--dangerously-skip-permissions` support) | **Low** |
| **No auth status probing** | Can't tell if a CLI is authenticated before listing models | **Low** |
| **No provider API model listing** | No BYOK path to call `/v1/models` directly (open-design has this) | **Low** |
| **Production requires runner registration** | If no runner is registered against production API, production shows 6 aliases only | **Ops** |

---

## 7. Should You Upgrade?

### Verdict: **Yes, you need a targeted upgrade.**

The current setup is a solid foundation (clean architecture, good catalog, D1-backed), but it has a critical bug (`FallbackModels` dead code) and missing capabilities (ACP, `fetchModels`, toolchain dirs) that directly cause the production model deficit.

### Why you can't skip the upgrade

1. **The `FallbackModels` bug means 19 agents are broken by design.** Even with a perfect production runner, 19 agents will only show "default." This is not a config issue — it's a code bug.

2. **ACP is the industry standard for agent model listing.** 9 agents (kimi, hermes, devin, kiro, kilo, vibe, trae-cli, reasonix, amr) use the ACP (Agent Client Protocol) JSON-RPC handshake to list models. Without ACP support, these agents can never list models live.

3. **The toolchain dir gap means CLIs go undetected.** If a user installs `opencode` via pnpm (lands in `~/Library/pnpm`) or `kimi` via its installer (lands in `~/.kimi-code/bin`), openFusion won't find them. This directly reduces the detected agent count.

### Why the upgrade is zero-cost

- **No paid APIs needed.** All model listing is done via local CLI subcommands (`opencode models`, `codex debug models`, ACP JSON-RPC). No provider API calls.
- **No new infrastructure.** The D1 database, Worker API, and Go runner all stay the same. The changes are in the Go runner's detection/listing code.
- **No new dependencies.** ACP is a JSON-RPC protocol over stdio — the Go runner already spawns CLI processes. Adding ACP is just a new message-handling loop.
- **Proven patterns.** Every change is ported from open-design's battle-tested implementation.

---

## 8. Recommended Upgrade Plan (Zero-Cost)

### Phase 1: Fix the critical bug (1 hour, immediate impact)

**Fix `FallbackModels` dead code + `Source` hardcoding.**

This single fix will make 19 agents show their curated fallback models instead of just "default."

| Step | File | Change |
|---|---|---|
| 1.1 | `apps/runner-go/internal/localagents/catalog.go:356-376` | When `ListModelsArgs` is empty OR live listing fails, use `def.FallbackModels` instead of just `[default]` |
| 1.2 | `apps/runner-go/internal/localagents/catalog.go:519` | Change `Source: "live"` to `Source: source` (use the actual source parameter) |
| 1.3 | `packages/db/src/queries.ts:1130-1133` | Update `isUserVisibleModel` to allow `source: "fallback"` (or use a new source value like `"hint"`) |

**Expected result:** 19 agents go from 1 model ("default") to 2-7 models each (their `FallbackModels` + "default"). Total model count jumps from ~10-15 to ~80+.

### Phase 2: Expand toolchain dirs (30 min, more CLIs detected)

**Port open-design's `wellKnownUserToolchainBins()` to Go.**

| Step | File | Change |
|---|---|---|
| 2.1 | `apps/runner-go/internal/discovery/discovery.go:103-121` | Add: `~/.volta/bin`, `~/.asdf/shims`, `~/Library/pnpm`, `~/.npm-packages/bin`, `~/.deno/bin`, `~/go/bin`, `~/.pyenv/shims`, `~/.local/share/mise/shims`, `~/.mise/shims`, `~/.opencode/bin`, `~/.kimi-code/bin`, `~/.vite-plus/bin` |
| 2.2 | `apps/runner-go/internal/discovery/discovery.go:103-121` | Resolve `NPM_CONFIG_PREFIX`, `MISE_DATA_DIR`, `FNM_DIR`, `VOLTA_HOME` env vars and add their bin dirs |
| 2.3 | `apps/runner-go/internal/discovery/discovery.go:103-121` | Add nvm/fnm per-version Node bin dirs (scan `~/.nvm/versions/node/*/bin`, `$FNM_DIR/node-versions/*/installation/bin`) |

**Expected result:** CLIs installed via volta, asdf, pnpm, deno, go, pyenv, mise, nvm, fnm are now detected.

### Phase 3: Add ACP support (1 day, 9 agents gain live listing)

**Port open-design's `detectAcpModels()` to Go.**

ACP (Agent Client Protocol) is a JSON-RPC protocol over stdio. The handshake:
1. Spawn the CLI with `acp` subcommand (e.g., `kimi acp`)
2. Send `initialize` request → read response
3. Send `session/new` request → read response
4. Extract `models` or `configOptions` from the `session/new` result
5. Close the process

| Step | File | Change |
|---|---|---|
| 3.1 | `apps/runner-go/internal/acp/acp.go` (new) | Implement ACP JSON-RPC client: `DetectModels(ctx, path, args) ([]ModelOption, error)` |
| 3.2 | `apps/runner-go/internal/localagents/catalog.go` | Add `FetchModels func(ctx, path, roots) ([]ModelOption, error)` to `AgentDef` |
| 3.3 | `apps/runner-go/internal/localagents/catalog.go` | Add `FetchModels: acp.DetectModels` to kimi, hermes, devin, kiro, kilo, vibe, trae-cli, reasonix |
| 3.4 | `apps/runner-go/internal/localagents/catalog.go:356-376` | In `listModels()`, try `FetchModels` when `ListModelsArgs` is empty |
| 3.5 | `apps/runner-go/internal/localagents/catalog.go` | Add AMR (vela) agent with `FetchModels: velaModelList` |

**Expected result:** 9 agents gain live model listing. Total agents with live listing goes from 4 to 13.

### Phase 4: Add custom `fetchModels` for remaining agents (half day)

| Step | Agent | Method |
|---|---|---|
| 4.1 | claude | `claude` has no `--list-models`. Use `FallbackModels` (already fixed in Phase 1) or read `~/.claude/config.json` for configured models. |
| 4.2 | pi | `pi --list-models` (output on stderr, TSV format) — port `defs/pi.ts:12-25` |
| 4.3 | gemini | `gemini` has no list subcommand. Use `FallbackModels`. Optionally read `~/.gemini/settings.json`. |
| 4.4 | qwen, copilot, qoder, aider, deepseek, amp, codebuddy, antigravity | Use `FallbackModels` (already fixed in Phase 1). These CLIs don't have list subcommands. |

### Phase 5: Add local agent plug system (half day, optional)

**Port open-design's `local-profiles.ts` to Go.**

| Step | File | Change |
|---|---|---|
| 5.1 | `apps/runner-go/internal/localagents/local-profiles.go` (new) | Read `~/.openfusion/agents.local.json` (or `$FH_AGENT_PROFILES_CONFIG`) |
| 5.2 | `apps/runner-go/internal/localagents/local-profiles.go` | Parse JSON array, create `AgentDef` inheriting from a base agent |
| 5.3 | `apps/runner-go/internal/localagents/catalog.go` | Append local profiles to `Catalog()` result |

**File format** (matching open-design):
```json
[
  {
    "id": "my-claude-fork",
    "baseAgent": "claude",
    "bin": "my-claude",
    "name": "My Claude Fork",
    "args": ["--prefix-arg"],
    "env": { "FOO": "bar" },
    "models": ["sonnet", "opus"]
  }
]
```

**Expected result:** Users can add custom CLI wrappers without code changes or recompiling.

### Phase 6: Add Codex native binary upgrade (2 hours, optional)

**Port open-design's `tryResolveCodexNativeBinary()` to Go.**

| Step | File | Change |
|---|---|---|
| 6.1 | `apps/runner-go/internal/discovery/discovery.go` | After finding `codex` on PATH, walk up the directory tree looking for `@openai/codex-<platform>-<arch>/vendor/<target-triple>/codex/codex` |
| 6.2 | `apps/runner-go/internal/discovery/discovery.go` | If found, use the native binary path instead of the node wrapper |

**Expected result:** Codex detection works from GUI-launched runners (LaunchAgent, systemd, Docker) where the node wrapper's shebang fails.

### Phase 7: Add execution adapters for more agents (ongoing)

Currently only `opencode` and `codex` have `Run` implementations. To make the other 21 agents executable:

| Priority | Agent | Why |
|---|---|---|
| High | claude | Most popular CLI, `claude-stream-json` format is well-documented |
| High | gemini | Google's CLI, `json-event-stream` format |
| Medium | qwen | Alibaba's CLI, plain text output |
| Medium | cursor-agent | `cursor-agent-stream-json` format |
| Low | ACP agents (kimi, hermes, devin, etc.) | ACP JSON-RPC execution is more complex but reusable |

Each adapter needs: `Detect()`, `ListModels()`, `Run()`. The `Run()` implementation spawns the CLI and streams output. Open-design's stream parsers (`claude-stream-json`, `acp-json-rpc`, `json-event-stream`, `plain`) are good references.

---

## 9. Implementation Details

### 9.1 Phase 1 fix — exact code change

**File:** `apps/runner-go/internal/localagents/catalog.go`

**Before (lines 356-376):**
```go
func listModels(ctx context.Context, defs []AgentDef, allowedRoots []string, toolDirs []string) []adapters.ModelRef {
    models := make([]adapters.ModelRef, 0)
    for _, def := range defs {
        tool := detect(ctx, def, toolDirs)
        if !tool.Found {
            continue
        }
        source := "detected"
        options := []ModelOption{model("default", "Default (CLI config)")}
        if len(def.ListModelsArgs) > 0 {
            if liveOptions := listLiveModels(ctx, def, tool.Path, allowedRoots); len(liveOptions) > 0 {
                options = liveOptions
                source = "live"
            }
        }
        for _, option := range options {
            models = append(models, modelRef(def, option, source))
        }
    }
    return models
}
```

**After:**
```go
func listModels(ctx context.Context, defs []AgentDef, allowedRoots []string, toolDirs []string) []adapters.ModelRef {
    models := make([]adapters.ModelRef, 0)
    for _, def := range defs {
        tool := detect(ctx, def, toolDirs)
        if !tool.Found {
            continue
        }
        source := "fallback"
        options := def.FallbackModels
        if len(options) == 0 {
            options = []ModelOption{model("default", "Default (CLI config)")}
        }
        if len(def.ListModelsArgs) > 0 {
            if liveOptions := listLiveModels(ctx, def, tool.Path, allowedRoots); len(liveOptions) > 0 {
                options = liveOptions
                source = "live"
            }
        }
        if def.FetchModels != nil {
            if fetched, err := def.FetchModels(ctx, def, tool.Path, allowedRoots); err == nil && len(fetched) > 0 {
                options = fetched
                source = "live"
            }
        }
        for _, option := range options {
            models = append(models, modelRef(def, option, source))
        }
    }
    return models
}
```

**Also fix `modelRef` (line 519):**

**Before:**
```go
Source: "live",
```

**After:**
```go
Source: source,
```

**Also update `isUserVisibleModel` in `packages/db/src/queries.ts:1130-1133`:**

**Before:**
```ts
function isUserVisibleModel(model: Pick<ModelRef, "model" | "source">) {
  if (model.model === "default") return true;
  return model.source !== "custom" && model.source !== "suggested" && model.source !== "fallback";
}
```

**After:**
```ts
function isUserVisibleModel(model: Pick<ModelRef, "model" | "source">) {
  if (model.model === "default") return true;
  return model.source !== "custom" && model.source !== "suggested";
}
```

### 9.2 Phase 2 — expanded toolchain dirs

**File:** `apps/runner-go/internal/discovery/discovery.go:103-121`

**After:**
```go
func WellKnownUserToolchainBins() []string {
    home, _ := os.UserHomeDir()
    dirs := []string{}
    if home != "" {
        dirs = append(dirs,
            filepath.Join(home, ".local", "bin"),
            filepath.Join(home, ".npm-global", "bin"),
            filepath.Join(home, ".npm-packages", "bin"),
            filepath.Join(home, ".bun", "bin"),
            filepath.Join(home, ".cargo", "bin"),
            filepath.Join(home, ".volta", "bin"),
            filepath.Join(home, ".asdf", "shims"),
            filepath.Join(home, "Library", "pnpm"),
            filepath.Join(home, ".deno", "bin"),
            filepath.Join(home, "go", "bin"),
            filepath.Join(home, ".pyenv", "shims"),
            filepath.Join(home, ".local", "share", "mise", "shims"),
            filepath.Join(home, ".mise", "shims"),
            filepath.Join(home, ".opencode", "bin"),
            filepath.Join(home, ".kimi-code", "bin"),
            filepath.Join(home, ".vite-plus", "bin"),
        )
        // nvm per-version Node bin dirs
        nvmDir := filepath.Join(home, ".nvm", "versions", "node")
        if entries, err := os.ReadDir(nvmDir); err == nil {
            for _, entry := range entries {
                if entry.IsDir() {
                    dirs = append(dirs, filepath.Join(nvmDir, entry.Name(), "bin"))
                }
            }
        }
    }
    // Env-resolved dirs
    if prefix := strings.TrimSpace(os.Getenv("NPM_CONFIG_PREFIX")); prefix != "" {
        dirs = append(dirs, filepath.Join(prefix, "bin"))
    }
    if npmPrefix := strings.TrimSpace(os.Getenv("npm_config_prefix")); npmPrefix != "" {
        dirs = append(dirs, filepath.Join(npmPrefix, "bin"))
    }
    if miseDir := strings.TrimSpace(os.Getenv("MISE_DATA_DIR")); miseDir != "" {
        dirs = append(dirs, filepath.Join(miseDir, "shims"))
    }
    if fnmDir := strings.TrimSpace(os.Getenv("FNM_DIR")); fnmDir != "" {
        if entries, err := os.ReadDir(filepath.Join(fnmDir, "node-versions")); err == nil {
            for _, entry := range entries {
                binDir := filepath.Join(fnmDir, "node-versions", entry.Name(), "installation", "bin")
                if info, err := os.Stat(binDir); err == nil && info.IsDir() {
                    dirs = append(dirs, binDir)
                }
            }
        }
    }
    if voltaHome := strings.TrimSpace(os.Getenv("VOLTA_HOME")); voltaHome != "" {
        dirs = append(dirs, filepath.Join(voltaHome, "bin"))
    }
    if agentHome := strings.TrimSpace(os.Getenv("FH_AGENT_HOME")); agentHome != "" {
        dirs = append(dirs, agentHome, filepath.Join(agentHome, "bin"))
    }
    if runtime.GOOS == "darwin" {
        dirs = append(dirs, "/opt/homebrew/bin", "/usr/local/bin")
    }
    return dedupeStrings(dirs)
}
```

### 9.3 Phase 3 — ACP client skeleton

**File:** `apps/runner-go/internal/acp/acp.go` (new)

```go
package acp

import (
    "bufio"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "os"
    "path/filepath"
    "time"

    "github.com/asthrix/openfusion/apps/runner-go/internal/executors/host"
)

type ModelOption struct {
    ID          string `json:"id"`
    DisplayName string `json:"display_name"`
}

type rpcRequest struct {
    JSONRPC string      `json:"jsonrpc"`
    ID      int         `json:"id"`
    Method  string      `json:"method"`
    Params  interface{} `json:"params,omitempty"`
}

type rpcResponse struct {
    JSONRPC string          `json:"jsonrpc"`
    ID      int             `json:"id"`
    Result  json.RawMessage `json:"result,omitempty"`
    Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
}

type sessionNewResult struct {
    Models        []ModelOption        `json:"models"`
    ConfigOptions []configOption       `json:"configOptions"`
}

type configOption struct {
    ID      string   `json:"id"`
    Type    string   `json:"type"`
    Values  []ModelOption `json:"values,omitempty"`
}

// DetectModels spawns a CLI with ACP subcommand, performs the JSON-RPC
// handshake, and extracts the model list from the session/new result.
func DetectModels(ctx context.Context, cliPath string, args []string, allowedRoots []string) ([]ModelOption, error) {
    workingDir, roots, cleanup := neutralWorkspace(allowedRoots)
    defer cleanup()

    result, err := host.Run(ctx, host.CommandSpec{
        Name:       cliPath,
        Args:       args,
        WorkingDir: workingDir,
        AllowedRoots: roots,
        Timeout:    15 * time.Second,
    })
    if err != nil && result.Stdout == "" {
        return nil, fmt.Errorf("acp handshake failed: %w", err)
    }

    return parseAcpModels(result.Stdout)
}

// parseAcpModels reads newline-delimited JSON-RPC responses and extracts
// models from the session/new result.
func parseAcpModels(output string) ([]ModelOption, error) {
    scanner := bufio.NewScanner(strings.NewReader(output))
    scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
    var models []ModelOption
    for scanner.Scan() {
        line := strings.TrimSpace(scanner.Text())
        if line == "" || !strings.HasPrefix(line, "{") {
            continue
        }
        var resp rpcResponse
        if err := json.Unmarshal([]byte(line), &resp); err != nil {
            continue
        }
        if resp.Error != nil {
            continue
        }
        var snr sessionNewResult
        if err := json.Unmarshal(resp.Result, &snr); err == nil {
            if len(snr.Models) > 0 {
                models = append(models, snr.Models...)
            }
            for _, opt := range snr.ConfigOptions {
                if opt.ID == "model" && len(opt.Values) > 0 {
                    models = append(models, opt.Values...)
                }
            }
        }
    }
    return models, nil
}
```

**Note:** The actual ACP implementation needs to use stdin/stdout pipes for a live JSON-RPC conversation, not just run and capture. The above is a simplified skeleton. See open-design's `apps/daemon/src/acp.ts:700` for the full implementation.

### 9.4 Phase 3 — wiring ACP into the catalog

**File:** `apps/runner-go/internal/localagents/catalog.go`

Add to `AgentDef`:
```go
type AgentDef struct {
    // ... existing fields ...
    FetchModels func(ctx context.Context, def AgentDef, path string, allowedRoots []string) ([]ModelOption, error)
}
```

Add to each ACP agent in `Catalog()`:
```go
{
    ID:   "kimi",
    Name: "Kimi CLI",
    // ...
    FetchModels: func(ctx context.Context, def AgentDef, path string, allowedRoots []string) ([]ModelOption, error) {
        return acp.DetectModels(ctx, path, []string{"acp"}, allowedRoots)
    },
    FallbackModels: models("moonshotai/kimi-k2", "moonshotai/moonshot-v1-auto"),
},
```

---

## 10. Verification Checklist

After implementing each phase, verify:

### Phase 1 verification
- [ ] Run `fusion-runner serve` locally → check `/api/models` returns `FallbackModels` for agents without `ListModelsArgs`
- [ ] Verify `Source` field is `"fallback"` for fallback models and `"live"` for live-listed models
- [ ] Verify `isUserVisibleModel` no longer hides `source: "fallback"` models
- [ ] Run `go test ./apps/runner-go/internal/localagents/...` — update tests to expect `FallbackModels`

### Phase 2 verification
- [ ] Install a CLI via pnpm (`pnpm add -g opencode`) → verify it's detected
- [ ] Install a CLI via volta (`volta install opencode`) → verify it's detected
- [ ] Set `NPM_CONFIG_PREFIX=/custom/prefix` → verify `/custom/prefix/bin` is searched

### Phase 3 verification
- [ ] Install `kimi` CLI → run `fusion-runner serve` → verify kimi models are live-listed via ACP
- [ ] Verify ACP handshake timeout (15s) doesn't block other agents
- [ ] Verify ACP failure falls back to `FallbackModels`

### Production verification
- [ ] Register a runner against the production API: `FUSION_CLOUD_URL=https://fusion-api.asthrix.workers.dev fusion-runner serve`
- [ ] Verify the runner appears as "online" in the production web app
- [ ] Verify `/api/models` on production returns the full model list
- [ ] Stop the runner → verify models are marked "unavailable" after 2 min
- [ ] Restart the runner → verify models return to "listed"/"detected"

### Model count expectations after all phases

| Phase | Agents with live listing | Total models (approx) |
|---|---|---|
| Current (broken) | 4 | ~10-15 |
| After Phase 1 | 4 live + 19 fallback | ~80-100 |
| After Phase 2 | 4 live + 19 fallback (more CLIs detected) | ~80-100 |
| After Phase 3 | 13 live + 10 fallback | ~120-150 |
| After Phase 4 | 15 live + 8 fallback | ~130-160 |

---

## Appendix A: Key File Reference

### openFusion

| Purpose | File |
|---|---|
| Agent catalog (23 agents) | `apps/runner-go/internal/localagents/catalog.go` |
| Detection logic (PATH, env, toolchain dirs) | `apps/runner-go/internal/discovery/discovery.go` |
| Adapter interface | `apps/runner-go/internal/adapters/adapters.go` |
| OpenCode adapter | `apps/runner-go/internal/adapters/opencode/opencode.go` |
| Codex adapter | `apps/runner-go/internal/adapters/codex/codex.go` |
| Runner entrypoint + registration | `apps/runner-go/cmd/fusion-runner/main.go` |
| Runner config | `apps/runner-go/internal/config/config.go` |
| Local UI (bypasses cloud) | `apps/runner-go/internal/localui/server.go` |
| D1 model queries | `packages/db/src/queries.ts` |
| Model selection logic | `packages/core/src/models/selection.ts` |
| Worker API model routes | `workers/api/src/routes/models.ts` |
| OpenAI-compatible API | `workers/api/src/routes/openai-compatible.ts` |
| Web app API base URL logic | `apps/web/src/lib/api.ts` |
| Provider catalog config | `configs/provider-catalog.yaml` |
| Shared types | `packages/shared/src/types.ts` |

### Open Design (reference)

| Purpose | File |
|---|---|
| Agent registry (24 defs + local profiles) | `apps/daemon/src/runtimes/registry.ts` |
| Main detection logic | `apps/daemon/src/runtimes/detection.ts` |
| PATH walking + `*_BIN` overrides | `apps/daemon/src/runtimes/executables.ts` |
| Launch path resolution (Codex native upgrade) | `apps/daemon/src/runtimes/launch.ts` |
| Spawn env construction | `apps/daemon/src/runtimes/env.ts` |
| Auth probing | `apps/daemon/src/runtimes/auth.ts` |
| Model cache + validation | `apps/daemon/src/runtimes/models.ts` |
| Agent def type | `apps/daemon/src/runtimes/types.ts` |
| Per-agent definitions | `apps/daemon/src/runtimes/defs/*.ts` (24 files) |
| Local agent plug (custom CLI wrappers) | `apps/daemon/src/runtimes/local-profiles.ts` |
| ACP JSON-RPC + `detectAcpModels` | `apps/daemon/src/acp.ts` |
| User toolchain bin dirs (GUI-launch hardening) | `packages/platform/src/index.ts:895` |
| Provider API model listing (BYOK) | `apps/daemon/src/integrations/provider-models.ts` |
| Sandbox mode (prod containment) | `apps/daemon/src/sandbox-mode.ts` |

---

## Appendix B: Open Design's Three Model-Fetching Strategies (Detail)

### Strategy 1: `listModels` (declarative CLI subcommand)

Runs a CLI subcommand and parses stdout. Defined in `AgentDef.listModels`:

```typescript
listModels: {
  args: ['debug', 'models'],           // CLI args
  parse: parseCodexDebugModels,        // stdout parser
}
```

Used by: Codex (`debug models`), OpenCode (`models`), Cursor Agent (`models`), Grok Build (`models`).

openFusion equivalent: `ListModelsArgs` + `ListModelsParser`. Already implemented for the same 4 agents.

### Strategy 2: `fetchModels` (custom async function)

For CLIs that need special handling (non-standard output, stderr, multiple calls):

```typescript
fetchModels: async (ctx, agentPath) => {
  // custom logic
  return [{ id: 'model-id', displayName: 'Model Name' }];
}
```

Used by:
- **AMR (vela):** `vela model list --format json` with retry, parses JSON `data[].id`
- **Pi:** `pi --list-models`, parses **stderr** TSV
- **Claude:** `loadMmdRouteModels()` — loads from local mmd/MMS proxy routes

openFusion equivalent: **None.** Needs a new `FetchModels` field on `AgentDef`.

### Strategy 3: `detectAcpModels` (ACP JSON-RPC handshake)

For CLIs that support the Agent Client Protocol. Spawns the CLI, performs a JSON-RPC handshake:

```
→ {"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}
← {"jsonrpc":"2.0","id":1,"result":{...}}
→ {"jsonrpc":"2.0","id":2,"method":"session/new","params":{...}}
← {"jsonrpc":"2.0","id":2,"result":{"models":[...],"configOptions":[...]}}
```

Extracts `models` or `configOptions` (where `id === "model"`) from the `session/new` result.

Used by: Hermes, Devin, Kimi, Kiro, Kilo, Vibe, Trae CLI, Reasonix, AMR.

openFusion equivalent: **None.** Needs a new `internal/acp/` package.

### Fallback: `fallbackModels` (static hints)

When all live fetching fails, falls back to a static list:

```typescript
fallbackModels: [
  { id: 'sonnet-4', displayName: 'Claude Sonnet 4' },
  { id: 'opus-4', displayName: 'Claude Opus 4' },
]
```

Marked with `modelsSource: 'fallback'` so the UI can show "these are hints, not live-discovered."

openFusion equivalent: `FallbackModels` field exists but is **dead code** — never referenced in `listModels()`. Phase 1 fixes this.

---

## Appendix C: Production Deployment Checklist

To ensure production shows full models:

1. **Register a runner against production:**
   ```bash
   FUSION_CLOUD_URL=https://fusion-api.asthrix.workers.dev fusion-runner serve
   ```

2. **Keep the runner online:** The runner must send heartbeats every <2 min. If running as a background service:
   - macOS: use `launchd` (LaunchAgent plist)
   - Linux: use `systemd` service
   - Docker: use `--restart unless-stopped`

3. **Install + authenticate CLIs on the runner host:**
   ```bash
   # OpenCode
   pnpm add -g @opencode-ai/opencode
   opencode auth login

   # Codex
   npm install -g @openai/codex
   codex login

   # Claude
   npm install -g @anthropic-ai/claude-code
   claude auth login

   # Kimi (ACP)
   npm install -g @kimi-code/kimi
   kimi auth login
   ```

4. **Verify detection:** Check the runner's registration payload includes models:
   ```bash
   curl https://fusion-api.asthrix.workers.dev/api/models | jq '.data | length'
   ```

5. **Monitor runner status:** Check the runners page in the web app. If the runner shows "offline," models will be marked "unavailable."

6. **Multiple runners:** If you have multiple machines, register a runner on each. Models are deduped by `runner+adapter+provider+model` (`dedupeRunnerModels` in `packages/db/src/queries.ts:1085-1112`), preferring higher-availability and org-scoped models.

---

**End of report.**