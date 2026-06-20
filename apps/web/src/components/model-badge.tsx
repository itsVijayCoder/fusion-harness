import { cn } from "@/lib/utils";

const adapterConfig: Record<string, { label: string; bg: string; text: string }> = {
  opencode: { label: "OC", bg: "bg-orange-500/20", text: "text-orange-400" },
  claude: { label: "Cl", bg: "bg-amber-500/20", text: "text-amber-400" },
  codex: { label: "Cx", bg: "bg-green-500/20", text: "text-green-400" },
  "cursor-agent": { label: "Cu", bg: "bg-blue-500/20", text: "text-blue-400" },
  gemini: { label: "Gm", bg: "bg-purple-500/20", text: "text-purple-400" },
  qwen: { label: "Qw", bg: "bg-cyan-500/20", text: "text-cyan-400" },
  qoder: { label: "Qd", bg: "bg-pink-500/20", text: "text-pink-400" },
  copilot: { label: "Cp", bg: "bg-teal-500/20", text: "text-teal-400" },
  deepseek: { label: "Ds", bg: "bg-blue-600/20", text: "text-blue-400" },
  kimi: { label: "Km", bg: "bg-indigo-500/20", text: "text-indigo-400" },
  hermes: { label: "He", bg: "bg-rose-500/20", text: "text-rose-400" },
  pi: { label: "Pi", bg: "bg-violet-500/20", text: "text-violet-400" },
  aider: { label: "Ai", bg: "bg-red-500/20", text: "text-red-400" },
  devin: { label: "Dv", bg: "bg-sky-500/20", text: "text-sky-400" },
  "grok-build": { label: "Gr", bg: "bg-zinc-500/20", text: "text-zinc-300" },
  amp: { label: "Am", bg: "bg-lime-500/20", text: "text-lime-400" },
  kiro: { label: "Ki", bg: "bg-fuchsia-500/20", text: "text-fuchsia-400" },
  kilo: { label: "Kl", bg: "bg-emerald-500/20", text: "text-emerald-400" },
  vibe: { label: "Vb", bg: "bg-yellow-500/20", text: "text-yellow-400" },
  "trae-cli": { label: "Tr", bg: "bg-orange-600/20", text: "text-orange-400" },
  codebuddy: { label: "Cb", bg: "bg-teal-600/20", text: "text-teal-400" },
  reasonix: { label: "Re", bg: "bg-indigo-600/20", text: "text-indigo-400" },
  antigravity: { label: "Ag", bg: "bg-purple-600/20", text: "text-purple-400" },
  openrouter: { label: "OR", bg: "bg-slate-500/20", text: "text-slate-300" },
  "openrouter-fusion": { label: "OF", bg: "bg-slate-500/20", text: "text-slate-300" },
  "api-key": { label: "AK", bg: "bg-zinc-600/20", text: "text-zinc-300" },
  "cloudflare-ai-gateway": { label: "CF", bg: "bg-orange-500/20", text: "text-orange-400" },
};

type ModelBadgeProps = {
  adapter?: string;
  modelId?: string;
  size?: "sm" | "md";
  className?: string;
};

export function ModelBadge({ adapter, modelId, size = "md", className }: ModelBadgeProps) {
  const config = adapter ? adapterConfig[adapter] : undefined;
  const label = config?.label ?? (modelId?.slice(0, 2) ?? "??");
  const sizeClass = size === "sm" ? "size-5 text-[9px]" : "size-6 text-[10px]";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md font-bold",
        sizeClass,
        config ? `${config.bg} ${config.text}` : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}