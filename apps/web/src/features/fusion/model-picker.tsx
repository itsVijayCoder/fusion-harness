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
      <div className="fixed inset-0 z-40 bg-foreground/30" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 flex h-[min(560px,80vh)] w-[min(600px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RiCloseLine aria-hidden className="size-4" />
          </button>
        </div>
        <div className="border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/60 px-3 py-1.5">
            <RiSearchLine aria-hidden className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models..."
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No models found.</p>
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
                      "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-primary/30 bg-primary/10"
                        : "hover:bg-muted/60",
                      !model.available ? "cursor-not-allowed opacity-60 hover:bg-transparent" : "",
                    )}
                  >
                    <ProviderLogo id={model.provider || model.adapter} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{model.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {model.provider} · {model.adapter}
                      </p>
                    </div>
                    {!model.available ? (
                      <span className="inline-flex min-h-5 items-center rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-medium leading-none text-destructive">
                        unavailable
                      </span>
                    ) : isSelected ? (
                      <span className="flex size-5 items-center justify-center rounded-md text-primary">
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
