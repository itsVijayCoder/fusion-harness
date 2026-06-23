# GitHub App Setup Guide

This guide walks through creating and configuring the Fusion GitHub App for PR reviews.

## 1. Create the GitHub App

1. Go to **GitHub Settings > Developer settings > GitHub Apps > New GitHub App**
2. Fill in the following:

| Field | Value |
| --- | --- |
| GitHub App name | `Fusion PR Review` |
| Homepage URL | `https://your-fusion-deployment.example.com` |
| Webhook URL | `https://your-fusion-api.example.com/api/github/webhook` |
| Webhook secret (active) | Generate a strong random secret |

3. Set **Repository permissions**:

| Permission | Access | Purpose |
| --- | --- | --- |
| Metadata | Read-only | Required baseline |
| Contents | Read-only | Fetch repository content and PR refs |
| Pull requests | Read and write | Read PRs, review requests, publish reviews |
| Checks | Read and write | Create/update Fusion PR Review check run |
| Issues | Read and write | Optional PR timeline comments |
| Members | Read-only | Optional org/team reviewer mapping |

4. Set **Subscribe to events**:

```
Installation
Installation repositories
Pull request
Pull request review
Pull request review comment
Check suite
Check run
```

5. Click **Create GitHub App**

## 2. Generate a Private Key

After creating the app:
1. Scroll down to **Private keys**
2. Click **Generate a private key**
3. A `.pem` file will download — keep this secure

## 3. Note the App ID

Find the **App ID** on the app's general settings page (it's a numeric ID like `123456`).

## 4. Configure Worker Secrets

> **Important:** Run all `wrangler` commands from the `workers/api/` directory, not the repo root. The `wrangler.jsonc` config lives there.

Set the following secrets on your Cloudflare Worker (run from `workers/api/`):

### GITHUB_APP_ID

```bash
cd workers/api
echo "123456" | npx wrangler secret put GITHUB_APP_ID
```

### GITHUB_APP_PRIVATE_KEY

> **Critical:** Do NOT paste the key interactively. Terminal line buffering can
> truncate multi-line PEM keys, which causes `ASN.1 parse error` or JWT signing
> failures in production. Always pipe the `.pem` file directly.

```bash
cd workers/api
cat /path/to/your-app-private-key.pem | npx wrangler secret put GITHUB_APP_PRIVATE_KEY
```

If you do not have the `.pem` file saved, download it from your GitHub App
settings page (Private keys > Generate a private key) and pipe it as shown above.

### GITHUB_WEBHOOK_SECRET

```bash
cd workers/api
echo "your_webhook_secret" | npx wrangler secret put GITHUB_WEBHOOK_SECRET
```

### GITHUB_APP_SLUG (non-secret var)

The app slug is used to build the install URL (`https://github.com/apps/<slug>/installations/new`)
and as a fallback when the GitHub API is temporarily unreachable. It is not
secret, so it goes in `wrangler.jsonc` vars, not in secrets:

```jsonc
{
  "vars": {
    "ENVIRONMENT": "production",
    "PUBLIC_APP_URL": "https://your-fusion-deployment.example.com",
    "GITHUB_APP_SLUG": "your-app-slug"
  }
}
```

Find the slug on your GitHub App's general settings page. It is the URL-friendly
name shown in the app's GitHub URL (e.g. `https://github.com/apps/your-app-slug`).

> **Note:** Do NOT use `--env production` — the worker config uses the default environment (no named envs are defined).

For local development, create `workers/api/.dev.vars` (already gitignored):

```bash
# workers/api/.dev.vars
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIE...
-----END RSA PRIVATE KEY-----
"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_SLUG=your-app-slug
```

## 5. Install the App

1. On the app's settings page, click **Install App**
2. Choose to install on your user account or an organization
3. Select the repositories you want Fusion to review
4. Complete the installation

## 6. Verify the Connection

1. Run the diagnostic health check:
   ```bash
   curl https://your-fusion-api.example.com/api/github/health
   ```
   Expected response with all `true` fields:
   ```json
   {
     "appIdConfigured": true,
     "privateKeyConfigured": true,
     "webhookSecretConfigured": true,
     "keyParseable": true,
     "jwtGeneratable": true,
     "appReachable": true,
     "installationsReachable": true,
     "error": null
   }
   ```

2. Navigate to `/settings/github` in your Fusion deployment
3. The page should show the app as connected with the correct App ID and slug
4. If there is an error, the page shows a remediation banner with the exact fix command
5. Click **Sync** to pull in installations and repositories

## 7. Configure Repository Settings

For each repository you want to enable PR reviews on:

1. Go to `/settings/github` in Fusion
2. Find the repository in the list
3. Link it to a Fusion workspace
4. Set a default runner
5. Enable auto-review (optional) with the trigger set to `review_requested`
6. Keep auto-publish disabled (MVP requires human approval)

## 8. Map Reviewers

Map Fusion users to GitHub logins so review requests trigger correctly:

1. Go to `/settings/github`
2. In the **Reviewer Mappings** section, create a link between a Fusion user and their GitHub login

## 9. Test the Flow

1. Open a PR on a connected repository
2. Request a review from the mapped GitHub user
3. Verify the PR appears in `/pr-reviews` with status `assigned`
4. Click the PR to view the diff
5. Click **Start Review** to trigger the local agent
6. Wait for draft comments to appear
7. Edit or reject comments as needed
8. Click **Publish** to post the review to GitHub

## Security Notes

- The GitHub App private key and webhook secret are stored as Cloudflare Worker secrets and never sent to the browser
- Installation tokens are short-lived (1 hour) and cached in-memory only
- Webhook payloads are stored in R2 for debugging but should be redacted if they contain sensitive information
- Fork PRs are marked as `ignored` by default and cannot trigger full reviews
- The runner does not execute test or build commands during review (MVP)
- All publish operations require human approval and are audited

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ASN.1 parse error` or `Failed to sign JWT` | Private key was truncated when pasted interactively | Re-set using pipe: `cat key.pem \| npx wrangler secret put GITHUB_APP_PRIVATE_KEY` |
| App Slug shows "Not loaded" | `GITHUB_APP_SLUG` not set and GitHub API unreachable | Set `GITHUB_APP_SLUG` in `wrangler.jsonc` vars and redeploy |
| No installations or repos after sync | Private key corrupt — JWT cannot be generated | Run `curl /api/github/health` to diagnose, then re-set the private key |
| `GITHUB_APP_PRIVATE_KEY is not configured` | Secret not set on the Worker | `cat key.pem \| npx wrangler secret put GITHUB_APP_PRIVATE_KEY` |
| Install button hidden | `appSlug` is empty in `/status` response | Set `GITHUB_APP_SLUG` in `wrangler.jsonc` vars |
| Sync returns 500 | GitHub API error or key issue | Check `/api/github/health` for the exact failure point |