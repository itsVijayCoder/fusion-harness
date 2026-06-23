# openFusion - Monorepo Deployment Guide

## Executive Summary

**Can you deploy via Git?** Yes. You can deploy the entire monorepo from GitHub using GitHub Actions.

**Can you deploy as a single unit?** Not with the current architecture. You have three separate deployable units on Cloudflare:

1. **Web App** (`openfusion`) — OpenNext/Next.js on Cloudflare Pages/Workers
2. **API Worker** (`fusion-api`) — Hono Worker with D1, KV, and Durable Objects
3. **MCP Worker** (`fusion-mcp`) — Hono Worker proxying to the API

These **must** remain separate deployments because Cloudflare Workers and Pages have different capabilities (Durable Objects cannot run on Pages, and OpenNext requires a specific build pipeline). However, you can automate deployment of all three from a single Git push.

---

## Current Architecture Breakdown

| Component | Type | Deploy Target | Bindings | External References |
|---|---|---|---|---|
| `apps/web` | Next.js + OpenNext | Cloudflare Pages (`openfusion`) | `IMAGES`, `ASSETS`, `WORKER_SELF_REFERENCE` | Calls `https://fusion-api.asthrix.workers.dev` |
| `workers/api` | Hono Worker | Cloudflare Worker (`fusion-api`) | `DB` (D1), `CONFIG_KV` (KV), `FUSION_RUN` (DO), `RUNNER_SESSION` (DO) | CORS allowed from `openfusion` |
| `workers/mcp` | Hono Worker | Cloudflare Worker (`fusion-mcp`) | None (stateless proxy) | Calls `https://fusion-api.asthrix.workers.dev` |
| `apps/runner-go` | Go CLI Binary | Not deployed (local/self-hosted) | N/A | Calls local or cloud API |

### Why Bindings Cannot Be Merged Into One

- **Cloudflare Pages** (where OpenNext web apps deploy) does **not** support Durable Objects or D1 databases directly inside the Pages Function in the same way Workers do.
- The **web app** (`openfusion`) is built by OpenNext into a Cloudflare Worker format, but it is managed as a Pages project and expects the `WORKER_SELF_REFERENCE` service binding for its own caching behavior.
- The **API worker** needs D1 migrations and KV namespaces that require a true Worker environment.
- The **MCP worker** is lightweight and stateless.

**Conclusion:** You need at least two deployments (Web + API). The MCP worker can optionally be merged into the API worker.

---

## Deployment Strategy: Git-Based CI/CD

### Step 1: Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml` in your repository root. This will deploy all three components on every push to `main`.

```yaml
name: Deploy All

on:
  push:
    branches: [main]
    paths:
      - "apps/web/**"
      - "workers/api/**"
      - "workers/mcp/**"
      - "packages/**"
      - ".github/workflows/deploy.yml"

  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ------------------------------------------------------------------
  # 1. Lint, Typecheck, and Test (PR + Main)
  # ------------------------------------------------------------------
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Run Go tests
        if: github.ref == 'refs/heads/main'
        run: npm run runner:test

  # ------------------------------------------------------------------
  # 2. Build & Deploy API Worker
  # ------------------------------------------------------------------
  deploy-api:
    needs: check
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Deploy API Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          workingDirectory: workers/api
          command: deploy

  # ------------------------------------------------------------------
  # 3. Build & Deploy MCP Worker
  # ------------------------------------------------------------------
  deploy-mcp:
    needs: [check, deploy-api]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Deploy MCP Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          workingDirectory: workers/mcp
          command: deploy

  # ------------------------------------------------------------------
  # 4. Build & Deploy Web App (OpenNext)
  # ------------------------------------------------------------------
  deploy-web:
    needs: [check, deploy-api]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      # OpenNext requires the full build before deploy
      - name: Build Web App
        run: npm run web:build
        env:
          NEXT_PUBLIC_API_BASE_URL: "https://fusion-api.asthrix.workers.dev"

      - name: Deploy Web App
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          workingDirectory: apps/web
          # OpenNext build output is deployed via wrangler
          command: deploy
```

### Step 2: Create Cloudflare API Token

1. Go to [Cloudflare Dashboard > My Profile > API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2. **Create Token** using the "Edit Cloudflare Workers" template.
3. Add these permissions:
   - `Cloudflare Pages:Edit`
   - `Workers Scripts:Edit`
   - `Account > Workers KV Storage:Edit`
   - `Account > D1:Edit`
   - `Account > Workers Scripts:Edit`
4. Add your Account and Zone resources.
5. Copy the token.

### Step 3: Add GitHub Secrets

In your GitHub repository:

- Go to **Settings > Secrets and variables > Actions**.
- Add `New repository secrets`:
  - `CF_API_TOKEN` — Your Cloudflare API token from Step 2.
  - `CF_ACCOUNT_ID` — Your Cloudflare Account ID (from the right sidebar of your Cloudflare dashboard).

### Step 4: Push and Verify

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add monorepo deployment pipeline"
git push origin main
```

Go to **Actions** tab in GitHub to watch the workflow run.

---

## Option A: Keep Current Multi-Worker Architecture (Recommended)

**Why this is best:**

- Each worker scales independently.
- API worker can have strict bindings (D1, KV, DO) without complicating the web app.
- Web app can be rebuilt and deployed separately from API changes.
- MCP can be updated without risking the API.

**Trade-off:** You manage three Wrangler configs and three deployed URLs.

---

## Option B: Merge MCP Worker INTO API Worker

If you want one fewer deployment, you can merge the MCP worker into the API worker.

### What changes:

In `workers/api/src/index.ts`, mount the MCP routes:

```typescript
import { mcpRoutes } from "./routes/mcp";

// Add this line
app.route("/mcp", mcpRoutes);
```

Create `workers/api/src/routes/mcp.ts` by adapting the logic from `workers/mcp/src/index.ts` but using the API worker's local `Env` instead of `FUSION_API_URL`.

**Pros:**
- One less Worker deployment.
- MCP tools can call API services directly (no HTTP hop).

**Cons:**
- Slightly larger Worker bundle.
- Any MCP bug can affect the API.

### Updated wrangler.jsonc for API (includes MCP):

No changes needed — the MCP endpoint is just another route in the same Worker.

---

## Option C: Merge API Into the Web App Worker (Advanced / Not Recommended)

**This is technically possible but strongly discouraged** because:

1. The OpenNext build pipeline is complex. Mounting Hono routers inside it requires deep Wrangler knowledge.
2. Durable Objects inside OpenNext Pages Functions are experimental and fragile.
3. You lose the separation of concerns between frontend rendering and backend API logic.
4. Web app redeploys (which are frequent) would also redeploy the API layer.

**Only consider this if:** you want to eliminate CORS entirely by making `/api/*` served from the same origin.

**How it would work:**

You would create a custom Webpack build that bundles both Next.js and Hono into a single Worker entry point. This is beyond the scope of standard OpenNext.

---

## Variables and Environment Strategy

You currently have hardcoded URLs in `wrangler.jsonc` files:

| File | Hardcoded Value |
|---|---|
| `apps/web/wrangler.jsonc` | `NEXT_PUBLIC_API_BASE_URL: "https://fusion-api.asthrix.workers.dev"` |
| `apps/web/next.config.ts` | `NEXT_PUBLIC_API_BASE_URL: "https://fusion-api.asthrix.workers.dev"` |
| `workers/api/wrangler.jsonc` | `PUBLIC_APP_URL: "https://openfusion.asthrix.workers.dev"` |
| `workers/mcp/wrangler.jsonc` | `FUSION_API_URL: "https://fusion-api.asthrix.workers.dev"` |

### Recommended Fix for Production/Staging

Use `wrangler.toml` or `.dev.vars` for local development, and **Wrangler Secrets** for production values instead of hardcoding them in `wrangler.jsonc`.

For CI/CD, you can inject environment-specific values before deploy:

```yaml
# In GitHub Actions, before deploy:
- name: Set production vars
  working-directory: apps/web
  run: |
    echo '{"name":"openfusion","vars":{"NEXT_PUBLIC_API_BASE_URL":"https://fusion-api.asthrix.workers.dev"}}' > wrangler.jsonc
```

However, it is cleaner to keep `wrangler.jsonc` as the base config and use [Wrangler Environments](https://developers.cloudflare.com/workers/wrangler/environments/):

Create `wrangler.staging.jsonc` and `wrangler.production.jsonc` per worker if you need multiple environments.

---

## Deployment Checklist

- [ ] Untrack `apps/runner-go/dist/` from Git (already done in `.gitignore`).
- [ ] Run `git rm -r --cached apps/runner-go/dist/` to remove compiled binaries from the repo.
- [ ] Create `.github/workflows/deploy.yml` (see Step 1).
- [ ] Generate Cloudflare API Token with Pages + Workers + KV + D1 permissions.
- [ ] Add `CF_API_TOKEN` and `CF_ACCOUNT_ID` to GitHub Secrets.
- [ ] Confirm Workers exist in Cloudflare Dashboard:
  - `fusion-api`
  - `fusion-mcp`
  - `openfusion` (Pages project)
- [ ] Confirm D1 database `openfusion_dev` and KV namespace `CONFIG_KV` exist and are bound.
- [ ] Push to `main` and verify GitHub Actions succeeds.
- [ ] Confirm all three URLs respond:
  - `https://openfusion.asthrix.workers.dev`
  - `https://fusion-api.asthrix.workers.dev/api/health`
  - `https://fusion-mcp.asthrix.workers.dev`

---

## Binding Reference Map

This map explains where each binding lives and how to access it.

| Binding | Type | Owner | Consumers | Access Pattern |
|---|---|---|---|---|
| `DB` | D1 Database | `fusion-api` | Web app, MCP worker | HTTP API calls |
| `CONFIG_KV` | KV Namespace | `fusion-api` | Web app, MCP worker | HTTP API calls |
| `FUSION_RUN` | Durable Object | `fusion-api` | Web app (via API) | Internal DO stub |
| `RUNNER_SESSION` | Durable Object | `fusion-api` | Web app (via API) | Internal DO stub |
| `IMAGES` | Images | `openfusion` | Web app only | Direct binding |
| `ASSETS` | Assets | `openfusion` | Web app only | Direct binding |
| `WORKER_SELF_REFERENCE` | Service | `openfusion` | Web app only | Self-reference |

> **Important:** D1, KV, and Durable Objects cannot be directly imported or used inside the OpenNext web app. The web app **must** call the API worker over HTTP. This is by design and is the correct Cloudflare architecture.

---

## Single Deployment? Final Verdict

**No.** You cannot deploy `openfusion`, `fusion-api`, and `fusion-mcp` as a single Cloudflare Worker while keeping Next.js + OpenNext. You have three independent units by design.

**What you CAN do:**
- Merge **MCP into API** (Option B) to reduce from 3 → 2 deployments.
- Keep all three but deploy them **automatically from one Git push** using GitHub Actions.
- Use a **single Git repository** (which you already have) to manage all three.

**Best Practice:** Keep them separate, automate deployment via GitHub Actions, and let Cloudflare's edge network route traffic between them. This is the standard pattern for Cloudflare micro-workers.

---

## Next Steps

1. Run `git rm -r --cached apps/runner-go/dist/` now.
2. Create `.github/workflows/deploy.yml`.
3. Add secrets to GitHub.
4. Push to `main`.
5. Monitor Actions and verify all endpoints.

If you want to proceed with **Option B** (merging MCP into API) as a follow-up task, that requires moving `/mcp` routes into `workers/api` and deleting the `workers/mcp` workspace.
