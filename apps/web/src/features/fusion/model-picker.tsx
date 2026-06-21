"use client";

import { RiCheckLine, RiCloseLine, RiSearchLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { ProviderLogo } from "@/components/provider-logo";
import type { ModelOption } from "./types";
import { cn } from "@/lib/utils";

type ModelPickerProps = {
  models: ModelOption[];
  selectedIds: string[];
  onToggle: (modelId: string) => void;
  onClose: () => void;
  title?: string;
  single?: boolean;
  selectedSingleId?: string | null;
  onPickSingle?: (modelId: string) => void;
};

export function ModelPicker({
  models,
  selectedIds,
  onToggle,
  onClose,
  title = "Select Models",
  single = false,
  selectedSingleId,
  onPickSingle,
}: ModelPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return models;
    const q = query.toLowerCase();
    return models.filter(
      (m) => m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
    );
  }, [models, query]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
      <div className="od-chrome fixed left-1/2 top-1/2 z-50 flex h-[min(560px,80vh)] w-[min(600px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--od-radius-md)] border border-[var(--od-border)] bg-[var(--od-panel)] shadow-[var(--od-shadow-md)]">
        <div className="flex items-center justify-between border-b border-[var(--od-border)] px-4 py-3">
          <h2 className="od-card-title">{title}</h2>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-[var(--od-radius-sm)] border-0 bg-transparent p-0 text-[var(--od-muted)] transition-colors hover:bg-[var(--od-subtle)] hover:text-[var(--od-text)]"
          >
            <RiCloseLine aria-hidden className="size-4" />
          </button>
        </div>
        <div className="border-b border-[var(--od-border)] px-4 py-2.5">
          <div className="flex items-center gap-2 rounded-[var(--od-radius-sm)] border border-[var(--od-border)] bg-[var(--od-subtle)] px-3 py-1.5">
            <RiSearchLine aria-hidden className="size-4 text-[var(--od-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models..."
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12.5px] text-[var(--od-text)] outline-none placeholder:text-[var(--od-faint)] focus:ring-0"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12.5px] text-[var(--od-muted)]">No models found.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map((model) => {
                const isSelected = single
                  ? selectedSingleId === model.id
                  : selectedIds.includes(model.id);
                return (
                  <button
                    key={model.id}
                    disabled={!model.available}
                    onClick={() => {
                      if (!model.available) return;
                      if (single) {
                        onPickSingle?.(model.id);
                        onClose();
                      } else {
                        onToggle(model.id);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-[var(--od-radius)] border border-transparent px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-[var(--od-border-strong)] bg-[var(--od-accent-tint)]"
                        : "hover:bg-[var(--od-subtle)]",
                      !model.available ? "cursor-not-allowed opacity-60 hover:bg-transparent" : "",
                    )}
                  >
                    <ProviderLogo id={model.provider || model.adapter} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-[var(--od-text)]">{model.name}</p>
                      <p className="truncate text-[11.5px] text-[var(--od-muted)]">
                        {model.provider} · {model.adapter}
                      </p>
                    </div>
                    {!model.available ? (
                      <span className="od-pill is-negative">unavailable</span>
                    ) : isSelected ? (
                      <span className="flex size-5 items-center justify-center rounded-[var(--od-radius-sm)] text-[var(--od-accent-strong)]">
                        <RiCheckLine aria-hidden className="size-4" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
