import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type ProviderLogoProps = {
  id?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | number;
  framed?: boolean;
  className?: string;
  title?: string;
};

type LogoAsset = {
  src: string;
  mono?: boolean;
  ext?: "svg" | "png";
};

const sizePx = {
  xs: 18,
  sm: 22,
  md: 28,
  lg: 36,
} as const;

const agentIconExt: Record<string, "svg" | "png"> = {
  amr: "svg",
  claude: "svg",
  codex: "svg",
  gemini: "svg",
  opencode: "svg",
  "cursor-agent": "svg",
  copilot: "svg",
  qwen: "svg",
  qoder: "svg",
  deepseek: "svg",
  reasonix: "svg",
  mimo: "svg",
  hermes: "svg",
  "grok-build": "svg",
  kimi: "svg",
  pi: "svg",
  kiro: "svg",
  kilo: "svg",
  vibe: "svg",
  antigravity: "svg",
  aider: "png",
  "trae-cli": "png",
  devin: "png",
};

const monoAgentIcons = new Set([
  "cursor-agent",
  "opencode",
  "hermes",
  "mimo",
  "kilo",
  "grok-build",
]);

const providerIconSrc: Record<string, string> = {
  anthropic: "/model-icons/anthropic.svg",
  "black-forest-labs": "/model-icons/black-forest-labs.svg",
  bfl: "/model-icons/black-forest-labs.svg",
  bytedance: "/model-icons/bytedance.svg",
  cloudflare: "/model-icons/cloudflare.svg",
  elevenlabs: "/model-icons/elevenlabs.svg",
  fishaudio: "/model-icons/fishaudio.svg",
  flux: "/model-icons/flux.svg",
  git: "/model-icons/git.svg",
  google: "/model-icons/google-gemini.svg",
  imagerouter: "/model-icons/openrouter.svg",
  minimax: "/model-icons/minimax.svg",
  openai: "/model-icons/openai.svg",
  openrouter: "/model-icons/openrouter.svg",
  suno: "/model-icons/suno.svg",
  xai: "/model-icons/x.svg",
  docker: "/model-icons/docker.svg",
};

const providerToAgentIcon: Record<string, string> = {
  "antigravity": "antigravity",
  "aider": "aider",
  "claude": "claude",
  "codex": "codex",
  "copilot": "copilot",
  "cursor-agent": "cursor-agent",
  "deepseek": "deepseek",
  "devin": "devin",
  "gemini": "gemini",
  "grok-build": "grok-build",
  "hermes": "hermes",
  "kiro": "kiro",
  "kilo": "kilo",
  "kimi": "kimi",
  "moonshotai": "kimi",
  "opencode": "opencode",
  "pi": "pi",
  "qoder": "qoder",
  "qwen": "qwen",
  "reasonix": "reasonix",
  "trae-cli": "trae-cli",
  "vibe": "vibe",
};

const aliases: Record<string, string> = {
  "anthropic-compatible": "anthropic",
  "claude-code": "claude",
  "cloudflare-ai-gateway": "cloudflare",
  "dall-e": "openai",
  "dalle": "openai",
  "google-gemini": "google",
  "grok": "xai",
  "moonshot": "moonshotai",
  "openrouter-fusion": "openrouter",
  "x": "xai",
};

const providerLabels: Record<string, string> = {
  "aihubmix": "AIHubMix",
  "amp": "Amp",
  "anthropic": "Anthropic",
  "antigravity": "Antigravity",
  "api-key": "API Key",
  "black-forest-labs": "Black Forest Labs",
  "bfl": "Black Forest Labs",
  "bytedance": "ByteDance",
  "claude": "Claude Code",
  "cloudflare": "Cloudflare",
  "cloudflare-ai-gateway": "Cloudflare AI Gateway",
  "codex": "Codex",
  "codebuddy": "CodeBuddy",
  "copilot": "Copilot",
  "cursor-agent": "Cursor Agent",
  "deepseek": "DeepSeek",
  "devin": "Devin",
  "docker": "Docker",
  "elevenlabs": "ElevenLabs",
  "fishaudio": "FishAudio",
  "flux": "FLUX",
  "gemini": "Gemini CLI",
  "git": "Git",
  "google": "Google Gemini",
  "hermes": "Hermes",
  "imagerouter": "ImageRouter",
  "kiro": "Kiro",
  "kilo": "Kilo",
  "kimi": "Kimi",
  "minimax": "MiniMax",
  "moonshotai": "Moonshot AI",
  "opencode": "OpenCode",
  "openai": "OpenAI",
  "openrouter": "OpenRouter",
  "openrouter-fusion": "OpenRouter Fusion",
  "pi": "Pi",
  "qoder": "Qoder",
  "qwen": "Qwen",
  "reasonix": "Reasonix",
  "suno": "Suno",
  "trae-cli": "Trae CLI",
  "vibe": "Mistral Vibe",
  "xai": "xAI",
};

export function ProviderLogo({
  id,
  size = "md",
  framed = true,
  className,
  title,
}: ProviderLogoProps) {
  const normalized = normalizeProviderId(id);
  const pixels = typeof size === "number" ? size : sizePx[size];
  const markSize = Math.max(12, Math.round(pixels * (framed ? 0.62 : 0.9)));
  const asset = getLogoAsset(normalized);
  const label = title ?? providerLabel(id ?? normalized);
  const initials = providerInitials(id ?? normalized);
  const wrapperStyle = {
    width: pixels,
    height: pixels,
    flexBasis: pixels,
  } as CSSProperties;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none text-foreground",
        framed ? "rounded-lg border border-border bg-card shadow-xs" : "bg-transparent",
        className,
      )}
      style={wrapperStyle}
      title={label}
      aria-hidden="true"
    >
      {asset ? (
        asset.mono ? (
          <span
            className="block bg-current"
            style={{
              width: markSize,
              height: markSize,
              WebkitMaskImage: `url("${asset.src}")`,
              WebkitMaskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskSize: "contain",
              maskImage: `url("${asset.src}")`,
              maskPosition: "center",
              maskRepeat: "no-repeat",
              maskSize: "contain",
            }}
          />
        ) : (
          <Image
            src={asset.src}
            alt=""
            width={markSize}
            height={markSize}
            className="block object-contain"
            style={{ width: markSize, height: markSize }}
            draggable={false}
            unoptimized
          />
        )
      ) : (
        <span
          className="font-mono font-bold tracking-normal text-muted-foreground"
          style={{ fontSize: Math.max(9, Math.round(pixels * 0.32)) }}
        >
          {initials}
        </span>
      )}
    </span>
  );
}

export function providerLabel(value?: string | null) {
  const normalized = normalizeProviderId(value);
  return providerLabels[value ?? ""] ?? providerLabels[normalized] ?? titleCase(value ?? normalized);
}

export function normalizeProviderId(value?: string | null) {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "unknown";
  const cleaned = raw.replace(/_/g, "-");
  return aliases[cleaned] ?? cleaned;
}

function getLogoAsset(id: string): LogoAsset | null {
  const providerSrc = providerIconSrc[id];
  if (providerSrc) return { src: providerSrc };

  const agentId = providerToAgentIcon[id] ?? id;
  const ext = agentIconExt[agentId];
  if (!ext) return null;

  return {
    src: `/agent-icons/${agentId}.${ext}`,
    ext,
    mono: ext === "svg" && monoAgentIcons.has(agentId),
  };
}

function providerInitials(value: string) {
  const label = providerLabel(value);
  const words = label
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (words[0] ?? value).slice(0, 2).toUpperCase();
}

function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
