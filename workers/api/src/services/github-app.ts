import { createSign } from "node:crypto";
import type { Env } from "../env";

const GITHUB_API_BASE = "https://api.github.com";
const JWT_TTL_SECONDS = 9 * 60;
const TOKEN_RENEW_BUFFER_MS = 5 * 60 * 1000;
const APP_DETAILS_CACHE_TTL_SECONDS = 60 * 60;
const APP_DETAILS_CACHE_KEY = "github:app-details";

type CachedInstallationToken = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<number, CachedInstallationToken>();

export class GitHubAppConfigError extends Error {
  readonly remediation: string;

  constructor(message: string, remediation: string) {
    super(message);
    this.name = "GitHubAppConfigError";
    this.remediation = remediation;
  }
}

export class GitHubAppAuth {
  constructor(private readonly env: Env) {}

  async getAppJwt(): Promise<string> {
    const pem = this.env.GITHUB_APP_PRIVATE_KEY;
    if (!pem) {
      throw new GitHubAppConfigError(
        "GITHUB_APP_PRIVATE_KEY is not configured",
        "Set the GitHub App private key as a Worker secret: cat private-key.pem | npx wrangler secret put GITHUB_APP_PRIVATE_KEY",
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      iat: now - 60,
      exp: now + JWT_TTL_SECONDS,
      iss: this.env.GITHUB_APP_ID,
    });
    const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
    const signingInput = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;

    let sign: ReturnType<typeof createSign>;
    try {
      sign = createSign("RSA-SHA256");
    } catch (error) {
      throw new GitHubAppConfigError(
        "Failed to initialize RSA signer",
        `Workers runtime node:crypto unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      sign.update(signingInput);
      sign.end();
      const signature = sign.sign(pem, "base64url");
      return `${signingInput}.${signature}`;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new GitHubAppConfigError(
        `Failed to sign JWT with GITHUB_APP_PRIVATE_KEY: ${detail}`,
        "The private key may be malformed, truncated, or in an unsupported format. Re-set it using: cat private-key.pem | npx wrangler secret put GITHUB_APP_PRIVATE_KEY",
      );
    }
  }

  async getInstallationToken(installationId: number): Promise<string> {
    const cached = tokenCache.get(installationId);
    if (cached && cached.expiresAt > Date.now() + TOKEN_RENEW_BUFFER_MS) {
      return cached.token;
    }

    const appJwt = await this.getAppJwt();
    const response = await fetch(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${appJwt}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": "fusion-harness-pr-review",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub installation token request failed (${response.status}): ${text}`);
    }

    const body = (await response.json()) as { token: string; expires_at: string };
    const expiresAt = new Date(body.expires_at).getTime();

    tokenCache.set(installationId, { token: body.token, expiresAt });
    return body.token;
  }

  async fetchAsApp(path: string, init: RequestInit = {}): Promise<Response> {
    const appJwt = await this.getAppJwt();
    return fetch(`${GITHUB_API_BASE}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${appJwt}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": "fusion-harness-pr-review",
        ...init.headers,
      },
    });
  }

  async fetchAsInstallation(installationId: number, path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getInstallationToken(installationId);
    return fetch(`${GITHUB_API_BASE}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `token ${token}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": "fusion-harness-pr-review",
        ...init.headers,
      },
    });
  }

  async getAppDetails(): Promise<GitHubAppDetails> {
    const cached = await this.readCachedAppDetails();
    if (cached) return cached;

    const response = await this.fetchAsApp("/app");
    if (!response.ok) {
      throw new Error(`GitHub App lookup failed (${response.status})`);
    }

    const body = (await response.json()) as {
      id: number;
      slug: string;
      name: string;
      html_url: string;
      owner?: { id: number };
    };

    const details: GitHubAppDetails = {
      id: body.id,
      slug: body.slug,
      name: body.name,
      htmlUrl: body.html_url,
      ownerId: body.owner?.id,
    };

    await this.writeCachedAppDetails(details);
    return details;
  }

  private async readCachedAppDetails(): Promise<GitHubAppDetails | null> {
    if (!this.env.CONFIG_KV) return null;
    try {
      const cached = await this.env.CONFIG_KV.get(APP_DETAILS_CACHE_KEY, "json");
      if (cached && typeof cached === "object" && "slug" in cached) {
        return cached as GitHubAppDetails;
      }
    } catch {
      // KV read failure is non-fatal — fall through to API fetch
    }
    return null;
  }

  private async writeCachedAppDetails(details: GitHubAppDetails): Promise<void> {
    if (!this.env.CONFIG_KV) return;
    try {
      await this.env.CONFIG_KV.put(APP_DETAILS_CACHE_KEY, JSON.stringify(details), {
        expirationTtl: APP_DETAILS_CACHE_TTL_SECONDS,
      });
    } catch {
      // KV write failure is non-fatal
    }
  }
}

export type GitHubAppDetails = {
  id: number;
  slug: string;
  name: string;
  htmlUrl: string;
  ownerId?: number;
};

export function clearInstallationTokenCache(installationId?: number) {
  if (installationId !== undefined) {
    tokenCache.delete(installationId);
    return;
  }
  tokenCache.clear();
}

export function base64UrlEncode(input: string | ArrayBuffer | Uint8Array): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}