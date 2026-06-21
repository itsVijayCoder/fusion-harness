import { ProviderLogo } from "@/components/provider-logo";

type ModelBadgeProps = {
  adapter?: string;
  modelId?: string;
  size?: "sm" | "md";
  className?: string;
};

export function ModelBadge({ adapter, modelId, size = "md", className }: ModelBadgeProps) {
  return <ProviderLogo id={adapter ?? modelId} size={size === "sm" ? "sm" : "md"} className={className} />;
}
