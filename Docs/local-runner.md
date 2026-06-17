# Local Runner

The local runner is a native Go binary under `apps/runner-go`.

## One-time macOS install

For the current source checkout, install the runner as a macOS LaunchAgent:

```bash
npm run runner:install:macos -- --cloud-url https://fusion-api.asthrix.workers.dev
```

The installer builds `fusion-runner`, installs it at `~/.fusion-harness/bin/fusion-runner`, creates a `~/.local/bin/fusion-runner` symlink, writes `~/.fusion-harness/config.json`, and registers `~/Library/LaunchAgents/com.asthrix.fusion-runner.plist`.

After that, the user does not need to run `fusion-runner serve` manually. macOS starts the runner on login and restarts it if it exits.

Useful maintenance commands:

```bash
npm run runner:logs:macos
npm run runner:uninstall:macos
npm run runner:uninstall:macos -- --all
```

## One-time Windows install

For the current source checkout, install the runner as a current-user Windows
scheduled task:

```powershell
npm run runner:install:windows -- --cloud-url https://fusion-api.asthrix.workers.dev
```

The installer builds `fusion-runner.exe` when Go is available, otherwise copies
the checked-in Windows binary from `apps/runner-go/dist`. It installs the runner
under `%USERPROFILE%\.fusion-harness\bin`, creates a `fusion-runner.cmd` shim,
adds the shim directory to the user PATH, writes
`%USERPROFILE%\.fusion-harness\config.json`, and registers the `AsthriX Fusion Runner`
scheduled task.

After that, the user does not need to run `fusion-runner serve` manually. Windows
starts the task on login. The task launches a small PowerShell wrapper that
restarts the runner if it exits and writes logs to
`%USERPROFILE%\.fusion-harness\logs`.

Useful maintenance commands:

```powershell
npm run runner:logs:windows
npm run runner:uninstall:windows
npm run runner:uninstall:windows -- --all
```

## Process model

Local development normally uses three processes:

- `npm run api:dev`
- `npm run dev`
- `fusion-runner serve --cloud-url http://localhost:8787`

In a deployed setup, the web app and API are hosted, so the user's trusted machine only runs the local runner:

- `fusion-runner serve --cloud-url <deployed-api-url>`

The hosted browser UI cannot directly spawn a local binary or scan the user's PATH. OpenDesign appears native because its Electron package starts a privileged daemon sidecar that performs local agent detection and CLI spawning. Fusion Harness uses the same trust boundary through the Go runner.

A one-click "start runner" button requires an installed Fusion Runner launcher, such as a signed desktop helper or registered `fusion-runner://` protocol handler. Until that installer exists, the UI can show/copy the exact command and refresh runner detection after the process starts.

The LaunchAgent installer is the current low-friction bridge: it removes the repeated terminal step, while the future signed desktop helper can add protocol-handler startup and automatic updates.

Initial commands:

- `fusion-runner login`
- `fusion-runner logout`
- `fusion-runner doctor`
- `fusion-runner discover`
- `fusion-runner serve`
- `fusion-runner run-test`
- `fusion-runner config`
- `fusion-runner update`

The current runner implements discovery, registration, job polling, local OpenCode/Codex execution, streamed run events, and artifact result posting. Production-grade runner auth, token rotation, installer packaging, and protocol-handler startup remain dedicated hardening tasks.
