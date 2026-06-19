import { ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = ["Home", "Models", "Fusion", "Chat", "Rankings", "Apps", "Docs"];

export function TopNav() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary">
            <Layers aria-hidden className="size-3.5 text-primary-foreground" />
          </span>
          <span className="text-sm font-semibold text-foreground">FusionLab</span>
        </div>
        <nav className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <button
              key={link}
              className={cn(
                "rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors duration-150",
                link === "Fusion"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link}
            </button>
          ))}
        </nav>
      </div>
      <button className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-muted">
        <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-semibold text-white">
          V
        </span>
        <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
      </button>
    </header>
  );
}