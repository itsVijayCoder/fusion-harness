import {
  RiArchiveLine,
  RiCodeSSlashLine,
  RiDashboardLine,
  RiGitBranchLine,
  RiKey2Line,
  RiRobot2Line,
  RiSettings3Line,
  RiShieldCheckLine,
  RiStackLine,
} from "@remixicon/react";
import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: RiDashboardLine },
  { href: "/chat", label: "Task Console", icon: RiRobot2Line },
  { href: "/runners", label: "Runners", icon: RiGitBranchLine },
  { href: "/models", label: "Models", icon: RiStackLine },
  { href: "/presets", label: "Presets", icon: RiSettings3Line },
  { href: "/workspaces", label: "Workspaces", icon: RiCodeSSlashLine },
  { href: "/settings/team", label: "Team", icon: RiShieldCheckLine },
  { href: "/settings/api", label: "API", icon: RiKey2Line },
  { href: "/settings/mcp", label: "MCP", icon: RiArchiveLine },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-sidebar lg:block">
        <div className="flex h-full flex-col">
          <Link href="/" className="flex h-16 items-center border-b border-sidebar-border px-5">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">Fusion Harness</span>
              <span className="truncate text-xs text-muted-foreground">Control plane</span>
            </div>
          </Link>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <Icon aria-hidden data-icon="inline-start" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="lg:pl-64">
        <div className="flex min-h-screen flex-col">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4 lg:hidden">
            <Link href="/" className="text-sm font-semibold">
              Fusion Harness
            </Link>
            <nav className="ml-auto flex gap-1 overflow-x-auto">
              {navItems.slice(0, 5).map((item) => (
                <Link key={item.href} href={item.href} className="rounded-md px-2 py-1 text-xs text-muted-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
