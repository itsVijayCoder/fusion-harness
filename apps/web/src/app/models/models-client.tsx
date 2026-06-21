"use client";

import type { ModelRef } from "@fusion-harness/shared";
import { RiArrowLeftLine } from "@remixicon/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProviderLogo, providerLabel } from "@/components/provider-logo";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

type ModelResponse = {
  aliases: Array<{ id: string; owned_by: string }>;
  data: ModelRef[];
};

type LoadState = {
  models: ModelResponse;
  source: "api" | "fallback" | "loading";
  error?: string;
};

const emptyModels: ModelResponse = { aliases: [], data: [] };

export function ModelsClient() {
  const [state, setState] = useState<LoadState>({
    models: emptyModels,
    source: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const models = await fetchJson<ModelResponse>("/api/models");
        if (!cancelled) {
          setState({ models, source: "api" });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            models: emptyModels,
            source: "fallback",
            error: error instanceof Error ? error.message : "API unavailable",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { models } = state;
  const providerCount = new Set(models.data.map((model) => model.provider ?? model.adapter)).size;
  const verifiedCount = models.data.filter((model) => model.availability === "verified").length;
  const cliSessionCount = models.data.filter((model) => model.authMode === "cli_session").length;

  return (
    <div className="od-workspace">
      <div className="od-container od-stack">
        <header>
          <div className="od-topline">
            <div className="od-title-tab">Model Inventory</div>
            <Link className="od-action" href="/chat">
              <RiArrowLeftLine aria-hidden className="size-4" />
              Back to Chat
            </Link>
          </div>
          <p className="od-page-copy">
            Local CLI sessions, cloud gateway models, aliases, and verified availability are listed with their provider marks.
          </p>
        </header>

      {state.source === "fallback" ? (
        <div className="od-notice">Showing local fallback data{state.error ? `: ${state.error}` : "."}</div>
      ) : null}
      {state.source === "loading" ? (
        <div className="od-notice">Loading signed-in model inventory...</div>
      ) : null}

        <section className="od-section">
          <div className="od-metric-grid">
            <MetricCard label="Discovered" value={models.data.length} detail="models available to Fusion" />
            <MetricCard label="Providers" value={providerCount} detail="unique provider identities" />
            <MetricCard label="Verified" value={verifiedCount} detail="known-good model entries" />
            <MetricCard label="CLI Sessions" value={cliSessionCount} detail="local authenticated agents" />
          </div>
        </section>

        <section className="od-section">
          <div className="od-section-head">
            <h2 className="od-section-title">Aliases</h2>
            <span className="od-section-meta">{models.aliases.length} routes</span>
          </div>
          {models.aliases.length ? (
            <div className="od-alias-grid">
              {models.aliases.map((alias) => (
                <article key={alias.id} className="od-alias-card">
                  <div className="od-alias-main">
                    <ProviderLogo id={alias.owned_by} size="lg" />
                    <div className="od-alias-body">
                      <div className="od-card-title truncate">{alias.id}</div>
                      <div className="od-card-meta">{alias.owned_by}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="od-empty">
              <strong>No aliases configured</strong>
              Add a fusion route when you want a stable OpenAI-compatible model alias.
            </div>
          )}
        </section>

        <section className="od-section">
          <div className="od-section-head">
            <h2 className="od-section-title">Discovered Models</h2>
            <span className="od-section-meta">{models.data.length} entries</span>
          </div>
        {models.data.length ? (
          <div className="od-table-wrap">
            <div className="od-table-scroll">
            <table className="od-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Adapter</th>
                  <th>Auth</th>
                  <th>Availability</th>
                  <th>Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {models.data.map((model) => (
                  <tr key={model.id}>
                    <td>
                      <div className="od-model-main">
                        <ProviderLogo id={model.provider ?? model.adapter} size="lg" />
                        <div className="od-model-body">
                          <div className="od-model-title truncate">{model.displayName ?? model.model}</div>
                          <div className="od-model-subtitle truncate">{model.model}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <LogoText id={model.provider ?? model.adapter} />
                    </td>
                    <td>
                      <LogoText id={model.adapter} />
                    </td>
                    <td>
                      <span className="od-pill">{formatValue(model.authMode)}</span>
                    </td>
                    <td>
                      <span className={cn("od-pill", availabilityTone(model.availability))}>
                        {formatValue(model.availability)}
                      </span>
                    </td>
                    <td>
                      <div className="od-capability-list">
                        {capabilitiesFor(model).length ? (
                          capabilitiesFor(model).map((capability) => (
                            <span key={capability} className="od-pill">
                              {formatCapability(capability)}
                            </span>
                          ))
                        ) : (
                          <span className="od-card-meta">none</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          <div className="od-empty">
            <strong>No discovered models</strong>
            Register a runner with local agent CLIs installed to populate CLI-backed models.
          </div>
        )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="od-metric-card">
      <div className="od-metric-label">{label}</div>
      <div className="od-metric-value">{value}</div>
      <div className="od-metric-detail">{detail}</div>
    </article>
  );
}

function LogoText({ id }: { id: string }) {
  return (
    <div className="od-agent-main">
      <ProviderLogo id={id} size="sm" />
      <span className="od-card-meta truncate">{providerLabel(id)}</span>
    </div>
  );
}

function capabilitiesFor(model: ModelRef) {
  return Object.entries(model.capabilities)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}

function availabilityTone(value: string) {
  if (value === "unavailable") return "is-negative";
  if (value === "configured_unverified" || value === "suggested") return "is-warning";
  if (value === "verified" || value === "detected" || value === "listed") return "is-positive";
  return "";
}

function formatValue(value: string) {
  return value.replace(/_/g, " ");
}

function formatCapability(value: string) {
  return value.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `API returned ${response.status}`);
  }

  return (await response.json()) as T;
}
