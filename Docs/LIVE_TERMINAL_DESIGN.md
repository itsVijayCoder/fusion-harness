# Live Terminal in the Model Card — Design

> A "Terminal" button inside each model card on the run page that opens a premium
> modal showing the model's live CLI process, thinking, and output. Same-adapter
> (provider) runs are serialized; different adapters run in parallel.

---

## 1. What we have today (constraints that shape the design)

1. **A model run = a CLI process.**
   - `opencode.Adapter.Run` spawns `opencode-cli run --format json ...`
   - `codex.Adapter.Run` spawns `codex exec --json ...`
   - Both go through `host.Run`, which captures `stdout`/`stderr` into `bytes.Buffer`
     and returns the **whole** blob at the end.
   - There is **no streaming** of the raw process today — the runner emits a single
     `panel.output.delta` with `fullChunk: true` after the process exits.

2. **"Provider" = adapter.**
   - `AdapterId` is `opencode | codex | claude | pi | ...` (runnable today: `opencode`, `codex`).
   - Model id is `adapter/model` (e.g. `opencode/anthropic/claude-sonnet-4`, `codex/gpt-5`).
   - So "same provider must not run parallel" maps cleanly to **same adapter**.

3. **Events already flow over a WebSocket.**
   - `FusionRunDO` → `/events` WS.
   - Event types `panel.thinking.delta`, `panel.output.delta`, `panel.tool_call`,
     `panel.tool_result` already exist in `RUN_EVENT_TYPES` — they're just rarely
     emitted because the adapters don't stream.
   - The UI already consumes them in `buildTrace` (`run-chat.tsx`).

4. **The `ModelCard`** (in `apps/web/src/app/runs/[runId]/run-chat.tsx`) is the right
   place for the button — it already has per-panel status, copy, expand, retry, and
   already opens an `OutputDrawer` modal.

So the feature is really two things:
**(A) stream the raw CLI process live**, and
**(B) a premium terminal modal in the card that renders it, with per-adapter serialization.**

---

## 2. Backend: stream the raw process (the part that makes "terminal" real)

Right now `host.Run` buffers everything. To get a real terminal feel you need
line/stream-level output. Two options, in order of effort:

### Option A — line-streamed stdout/stderr (recommended, low risk)

Change `host.Run` (or add a `host.RunStreaming`) to copy `cmd.Stdout`/`cmd.Stderr`
to an `io.Writer` / channel as it arrives, while still collecting the full buffer
for the result. The adapter's `emit` callback then fires `panel.output.delta`
(or a new `panel.terminal.delta`) per chunk with the raw text.

- Gives the live "typing" feel without a true PTY.
- `opencode --format json` and `codex --json` both emit newline-delimited JSON,
  so line-streaming maps perfectly.
- ~40 lines in `host.go`; lights up the existing event stream the UI already
  listens to.

### Option B — true PTY (xterm.js in the browser)

Use `creack/pty` in the runner so the child gets a TTY, stream bytes over a
WebSocket, render with `xterm.js`.

- Most "terminal" feel (ANSI colors, cursor control).
- Heaviest: new WS endpoint on the runner + a relay through the API + PTY lifecycle.
- Only worth it if you want full ANSI fidelity.

**Ship A first.** Layer xterm.js later for the judge/final "thinking" rendering
if you want ANSI.

---

## 3. New event types (add to `packages/shared/src/events.ts`)

```ts
"panel.terminal.delta"    // raw stdout/stderr chunk, preserves ANSI
"panel.terminal.thinking" // reasoning/thinking block from the model
```

The adapter emits these as it reads from the process. `buildTrace` in
`run-chat.tsx` already has the pattern — you just add a `terminal: string` and
`thinking: string` field to `PanelTrace`.

---

## 4. Per-adapter serialization (the "no parallel for same provider" rule)

This belongs in the **runner**, not the UI, because the runner is what actually
spawns the process. Today `fusion.Execute` fires all panels with a
`sync.WaitGroup` concurrently. Add an **adapter semaphore**: a
`map[adapter]*semaphore.Weighted` (or a simple buffered channel per adapter,
size 1). Before `runSelectedModel`, acquire the adapter's slot; release on return.

```go
// pseudo
locks := map[string]chan struct{}{}  // adapter -> size-1 channel
for _, m := range analysisModels {
    locks[m.Adapter] = make(chan struct{}, 1)
}
// in the goroutine:
locks[selected.Adapter] <- struct{}{}        // acquire
defer func() { <-locks[selected.Adapter] }()  // release
```

- Different adapters (opencode vs codex) run in parallel.
- Same adapter runs serially.
- Matches the rule exactly.
- The UI should reflect the queue position in the card ("queued behind 1 opencode run").

### Cloud path

For the cloud path (`executeCloudJob` in `main.go`), serialization has to happen
at the job-claim layer: the runner should not claim a second job for the same
adapter while one is running. That's a `lease`/`claim` filter — add an `adapter`
filter to `ClaimJob` and have the runner skip claiming same-adapter jobs while
one is in flight. (The local `fusion.Execute` path is the common one for the UI
you're describing, so start there.)

---

## 5. The UI: a "Terminal" button in the model card + a premium modal

In `ModelCard` (in `run-chat.tsx`), add a terminal button next to the existing
copy/expand buttons. It opens a new `TerminalModal` component (sibling to
`OutputDrawer` / `FinalOutputModal`).

### Button

Only show when the panel is `running`, `queued`, or has terminal/thinking output:

```tsx
{panel.adapter && (isRunning || panel.status === "queued" || panel.terminal || panel.thinking) ? (
  <button
    onClick={(e) => { e.stopPropagation(); onOpenTerminal(panel); }}
    title="Open live terminal"
    className="... premium styling ..."
  >
    <RiTerminalLine />
  </button>
) : null}
```

### TerminalModal — layout

```
┌─────────────────────────────────────────────────────────┐
│ ◉ opencode · anthropic/claude-sonnet-4    [running]  ⋮  │  ← header: badge, model, status pill, menu
├─────────────────────────────────────────────────────────┤
│ ▸ Thinking          ▸ Terminal          ▸ Output        │  ← tab strip
├─────────────────────────────────────────────────────────┤
│                                                          │
│   <live streamed content, monospace, ANSI-aware>         │
│   ▮  ← blinking cursor while running                     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ role: architect · 1.2k chars · 3200ms        [Copy] [⤓]  │  ← footer: meta + actions
└─────────────────────────────────────────────────────────┘
```

### Three tabs

- **Thinking** — renders `panel.thinking` (the model's reasoning block). Streamed,
  with a soft "thinking…" shimmer while running. Fed by `panel.thinking.delta` /
  `final.thinking.delta` events.
- **Terminal** — the raw CLI process output (`panel.terminal`), monospace,
  preserves whitespace/ANSI. This is where you see `opencode`/`codex` actually
  "working" — tool calls, file reads, the JSON event stream. A blinking block
  cursor at the end while `isRunning`. If you later go the xterm.js route, this
  tab becomes the xterm container.
- **Output** — the final parsed output (what `OutputDrawer` shows today), rendered
  with `MarkdownRenderer`.

### Premium touches that make it feel rich

- Backdrop blur + a subtle scale/opacity entrance animation (`framer-motion` or
  pure CSS `@keyframes`).
- A thin animated top border gradient (the "running" accent) that turns solid on
  completion.
- Status-aware chrome: running = primary accent glow + spinner; completed = green
  check; failed = destructive tint.
- Auto-scroll to bottom with a "jump to latest" button when the user scrolls up.
- A small live char/line counter in the footer.
- Keyboard: `Esc` to close, `Cmd/Ctrl+K` to copy.

### Queue state

When a panel is `queued` because its adapter is busy, the terminal modal shows a
dedicated "Waiting for opencode…" state with the queue position, instead of an
empty terminal. This makes the serialization rule visible and premium rather than
confusing.

---

## 6. Wiring it into `buildTrace`

Minimal change — extend `PanelTrace`:

```ts
type PanelTrace = {
  // ...existing
  terminal?: string;   // raw process stream
  thinking?: string;   // reasoning block
};
```

And handle the new events in `buildTrace`:

```ts
if (event.type === "panel.terminal.delta") { /* append to terminal */ }
if (event.type === "panel.thinking.delta") { /* append to thinking */ }
```

The existing `panel.output.delta` keeps feeding `text` (the parsed answer). So the
three tabs map to three event streams, all already flowing over the same WS.

---

## 7. Why this design fits the codebase

- **Reuses the event bus we already have.** No new transport for the basic
  version — `FusionRunDO` + the existing `/events` WS already carry per-panel
  deltas; we just add event types and emit them from the adapter.
- **The serialization rule is enforced where processes actually spawn** (the Go
  runner), not in the UI. The UI only *displays* queue state. This is correct —
  the UI can't truly prevent parallel execution because the runner is the one
  calling `exec.Command`.
- **`ModelCard` is already the right component** and already has the modal-opening
  pattern (`onOpenPanel` → `OutputDrawer`). The terminal button is a natural
  sibling.
- **"Provider" = adapter** is already a first-class concept (`AdapterId`,
  `panel.adapter`, `ModelRef.adapter`), so the rule is trivial to express.

---

## 8. Suggested build order

1. **Runner:** line-stream `host.Run` → emit `panel.terminal.delta` +
   `panel.thinking.delta` from both adapters. (~1–2 hrs)
2. **Runner:** adapter semaphore in `fusion.Execute`. (~30 min)
3. **Shared:** add the two event types to `events.ts`. (~5 min)
4. **Web:** extend `PanelTrace` + `buildTrace` to capture terminal/thinking. (~20 min)
5. **Web:** build `TerminalModal` with the 3 tabs + premium styling, add the button
   to `ModelCard`. (~2–3 hrs)
6. **Web:** queue-state UI for serialized panels. (~30 min)
7. **Later (optional):** true PTY + xterm.js for the Terminal tab; cloud-path
   adapter serialization in `ClaimJob`.

---

## 9. Key files

| Layer | File |
| --- | --- |
| Process exec | `apps/runner-go/internal/executors/host/host.go` |
| Adapters | `apps/runner-go/internal/adapters/opencode/opencode.go`, `apps/runner-go/internal/adapters/codex/codex.go` |
| Fusion orchestration | `apps/runner-go/internal/fusion/runner.go` |
| Cloud job exec | `apps/runner-go/cmd/fusion-runner/main.go` (`executeCloudJob`) |
| Event types | `packages/shared/src/events.ts` |
| Run event stream (WS) | `workers/api/src/durable-objects/FusionRunDO.ts` |
| Run page | `apps/web/src/app/runs/[runId]/run-chat.tsx` (`ModelCard`, `buildTrace`) |
| Existing modal pattern | `apps/web/src/components/output-drawer.tsx`, `apps/web/src/components/final-output-modal.tsx` |
| Model badge | `apps/web/src/components/model-badge.tsx` |
# Live Terminal in the Model Card — Design

> A "Terminal" button inside each model card on the run page that opens a premium
> modal showing the model's live CLI process, thinking, and output. Same-adapter
> (provider) runs are serialized; different adapters run in parallel.

---

## 1. What we have today (constraints that shape the design)

1. **A model run = a CLI process.**
   - `opencode.Adapter.Run` spawns `opencode-cli run --format json ...`
   - `codex.Adapter.Run` spawns `codex exec --json ...`
   - Both go through `host.Run`, which captures `stdout`/`stderr` into `bytes.Buffer`
     and returns the **whole** blob at the end.
   - There is **no streaming** of the raw process today — the runner emits a single
     `panel.output.delta` with `fullChunk: true` after the process exits.

2. **"Provider" = adapter.**
   - `AdapterId` is `opencode | codex | claude | pi | ...` (runnable today: `opencode`, `codex`).
   - Model id is `adapter/model` (e.g. `opencode/anthropic/claude-sonnet-4`, `codex/gpt-5`).
   - So "same provider must not run parallel" maps cleanly to **same adapter**.

3. **Events already flow over a WebSocket.**
   - `FusionRunDO` → `/events` WS.
   - Event types `panel.thinking.delta`, `panel.output.delta`, `panel.tool_call`,
     `panel.tool_result` already exist in `RUN_EVENT_TYPES` — they're just rarely
     emitted because the adapters don't stream.
   - The UI already consumes them in `buildTrace` (`run-chat.tsx`).

4. **The `ModelCard`** (in `apps/web/src/app/runs/[runId]/run-chat.tsx`) is the right
   place for the button — it already has per-panel status, copy, expand, retry, and
   already opens an `OutputDrawer` modal.

So the feature is really two things:
**(A) stream the raw CLI process live**, and
**(B) a premium terminal modal in the card that renders it, with per-adapter serialization.**

---

## 2. Backend: stream the raw process (the part that makes "terminal" real)

Right now `host.Run` buffers everything. To get a real terminal feel you need
line/stream-level output. Two options, in order of effort:

### Option A — line-streamed stdout/stderr (recommended, low risk)

Change `host.Run` (or add a `host.RunStreaming`) to copy `cmd.Stdout`/`cmd.Stderr`
to an `io.Writer` / channel as it arrives, while still collecting the full buffer
for the result. The adapter's `emit` callback then fires `panel.output.delta`
(or a new `panel.terminal.delta`) per chunk with the raw text.

- Gives the live "typing" feel without a true PTY.
- `opencode --format json` and `codex --json` both emit newline-delimited JSON,
  so line-streaming maps perfectly.
- ~40 lines in `host.go`; lights up the existing event stream the UI already
  listens to.

### Option B — true PTY (xterm.js in the browser)

Use `creack/pty` in the runner so the child gets a TTY, stream bytes over a
WebSocket, render with `xterm.js`.

- Most "terminal" feel (ANSI colors, cursor control).
- Heaviest: new WS endpoint on the runner + a relay through the API + PTY lifecycle.
- Only worth it if you want full ANSI fidelity.

**Ship A first.** Layer xterm.js later for the judge/final "thinking" rendering
if you want ANSI.

---

## 3. New event types (add to `packages/shared/src/events.ts`)

```ts
"panel.terminal.delta"    // raw stdout/stderr chunk, preserves ANSI
"panel.terminal.thinking" // reasoning/thinking block from the model
```

The adapter emits these as it reads from the process. `buildTrace` in
`run-chat.tsx` already has the pattern — you just add a `terminal: string` and
`thinking: string` field to `PanelTrace`.

---

## 4. Per-adapter serialization (the "no parallel for same provider" rule)

This belongs in the **runner**, not the UI, because the runner is what actually
spawns the process. Today `fusion.Execute` fires all panels with a
`sync.WaitGroup` concurrently. Add an **adapter semaphore**: a
`map[adapter]*semaphore.Weighted` (or a simple buffered channel per adapter,
size 1). Before `runSelectedModel`, acquire the adapter's slot; release on return.

```go
// pseudo
locks := map[string]chan struct{}{}  // adapter -> size-1 channel
for _, m := range analysisModels {
    locks[m.Adapter] = make(chan struct{}, 1)
}
// in the goroutine:
locks[selected.Adapter] <- struct{}{}        // acquire
defer func() { <-locks[selected.Adapter] }()  // release
```

- Different adapters (opencode vs codex) run in parallel.
- Same adapter runs serially.
- Matches the rule exactly.
- The UI should reflect the queue position in the card ("queued behind 1 opencode run").

### Cloud path

For the cloud path (`executeCloudJob` in `main.go`), serialization has to happen
at the job-claim layer: the runner should not claim a second job for the same
adapter while one is running. That's a `lease`/`claim` filter — add an `adapter`
filter to `ClaimJob` and have the runner skip claiming same-adapter jobs while
one is in flight. (The local `fusion.Execute` path is the common one for the UI
you're describing, so start there.)

---

## 5. The UI: a "Terminal" button in the model card + a premium modal

In `ModelCard` (in `run-chat.tsx`), add a terminal button next to the existing
copy/expand buttons. It opens a new `TerminalModal` component (sibling to
`OutputDrawer` / `FinalOutputModal`).

### Button

Only show when the panel is `running`, `queued`, or has terminal/thinking output:

```tsx
{panel.adapter && (isRunning || panel.status === "queued" || panel.terminal || panel.thinking) ? (
  <button
    onClick={(e) => { e.stopPropagation(); onOpenTerminal(panel); }}
    title="Open live terminal"
    className="... premium styling ..."
  >
    <RiTerminalLine />
  </button>
) : null}
```

### TerminalModal — layout

```
┌─────────────────────────────────────────────────────────┐
│ ◉ opencode · anthropic/claude-sonnet-4    [running]  ⋮  │  ← header: badge, model, status pill, menu
├─────────────────────────────────────────────────────────┤
│ ▸ Thinking          ▸ Terminal          ▸ Output        │  ← tab strip
├─────────────────────────────────────────────────────────┤
│                                                          │
│   <live streamed content, monospace, ANSI-aware>         │
│   ▮  ← blinking cursor while running                     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ role: architect · 1.2k chars · 3200ms        [Copy] [⤓]  │  ← footer: meta + actions
└─────────────────────────────────────────────────────────┘
```

### Three tabs

- **Thinking** — renders `panel.thinking` (the model's reasoning block). Streamed,
  with a soft "thinking…" shimmer while running. Fed by `panel.thinking.delta` /
  `final.thinking.delta` events.
- **Terminal** — the raw CLI process output (`panel.terminal`), monospace,
  preserves whitespace/ANSI. This is where you see `opencode`/`codex` actually
  "working" — tool calls, file reads, the JSON event stream. A blinking block
  cursor at the end while `isRunning`. If you later go the xterm.js route, this
  tab becomes the xterm container.
- **Output** — the final parsed output (what `OutputDrawer` shows today), rendered
  with `MarkdownRenderer`.

### Premium touches that make it feel rich

- Backdrop blur + a subtle scale/opacity entrance animation (`framer-motion` or
  pure CSS `@keyframes`).
- A thin animated top border gradient (the "running" accent) that turns solid on
  completion.
- Status-aware chrome: running = primary accent glow + spinner; completed = green
  check; failed = destructive tint.
- Auto-scroll to bottom with a "jump to latest" button when the user scrolls up.
- A small live char/line counter in the footer.
- Keyboard: `Esc` to close, `Cmd/Ctrl+K` to copy.

### Queue state

When a panel is `queued` because its adapter is busy, the terminal modal shows a
dedicated "Waiting for opencode…" state with the queue position, instead of an
empty terminal. This makes the serialization rule visible and premium rather than
confusing.

---

## 6. Wiring it into `buildTrace`

Minimal change — extend `PanelTrace`:

```ts
type PanelTrace = {
  // ...existing
  terminal?: string;   // raw process stream
  thinking?: string;   // reasoning block
};
```

And handle the new events in `buildTrace`:

```ts
if (event.type === "panel.terminal.delta") { /* append to terminal */ }
if (event.type === "panel.thinking.delta") { /* append to thinking */ }
```

The existing `panel.output.delta` keeps feeding `text` (the parsed answer). So the
three tabs map to three event streams, all already flowing over the same WS.

---

## 7. Why this design fits the codebase

- **Reuses the event bus we already have.** No new transport for the basic
  version — `FusionRunDO` + the existing `/events` WS already carry per-panel
  deltas; we just add event types and emit them from the adapter.
- **The serialization rule is enforced where processes actually spawn** (the Go
  runner), not in the UI. The UI only *displays* queue state. This is correct —
  the UI can't truly prevent parallel execution because the runner is the one
  calling `exec.Command`.
- **`ModelCard` is already the right component** and already has the modal-opening
  pattern (`onOpenPanel` → `OutputDrawer`). The terminal button is a natural
  sibling.
- **"Provider" = adapter** is already a first-class concept (`AdapterId`,
  `panel.adapter`, `ModelRef.adapter`), so the rule is trivial to express.

---

## 8. Suggested build order

1. **Runner:** line-stream `host.Run` → emit `panel.terminal.delta` +
   `panel.thinking.delta` from both adapters. (~1–2 hrs)
2. **Runner:** adapter semaphore in `fusion.Execute`. (~30 min)
3. **Shared:** add the two event types to `events.ts`. (~5 min)
4. **Web:** extend `PanelTrace` + `buildTrace` to capture terminal/thinking. (~20 min)
5. **Web:** build `TerminalModal` with the 3 tabs + premium styling, add the button
   to `ModelCard`. (~2–3 hrs)
6. **Web:** queue-state UI for serialized panels. (~30 min)
7. **Later (optional):** true PTY + xterm.js for the Terminal tab; cloud-path
   adapter serialization in `ClaimJob`.

---

## 9. Key files

| Layer | File |
| --- | --- |
| Process exec | `apps/runner-go/internal/executors/host/host.go` |
| Adapters | `apps/runner-go/internal/adapters/opencode/opencode.go`, `apps/runner-go/internal/adapters/codex/codex.go` |
| Fusion orchestration | `apps/runner-go/internal/fusion/runner.go` |
| Cloud job exec | `apps/runner-go/cmd/fusion-runner/main.go` (`executeCloudJob`) |
| Event types | `packages/shared/src/events.ts` |
| Run event stream (WS) | `workers/api/src/durable-objects/FusionRunDO.ts` |
| Run page | `apps/web/src/app/runs/[runId]/run-chat.tsx` (`ModelCard`, `buildTrace`) |
| Existing modal pattern | `apps/web/src/components/output-drawer.tsx`, `apps/web/src/components/final-output-modal.tsx` |
| Model badge | `apps/web/src/components/model-badge.tsx` |
 