"use client";

import {
  RiArchiveLine,
  RiCodeSSlashLine,
  RiDashboardLine,
  RiGitBranchLine,
  RiInformationLine,
  RiKey2Line,
  RiMoonLine,
  RiRobot2Line,
  RiSettings3Line,
  RiShieldCheckLine,
  RiStackLine,
} from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "AI Core",
    items: [
      { href: "/chat", label: "Chat", icon: RiRobot2Line },
      { href: "/runners", label: "Agents", icon: RiGitBranchLine },
      { href: "/models", label: "Model", icon: RiStackLine },
      { href: "/presets", label: "Assistants", icon: RiSettings3Line },
      { href: "/dashboard", label: "Capabilities", icon: RiDashboardLine },
    ],
  },
  {
    label: "Application",
    items: [
      { href: "/workspaces", label: "Workspaces", icon: RiCodeSSlashLine },
      { href: "/settings/team", label: "Team", icon: RiShieldCheckLine },
      { href: "/settings/api", label: "API", icon: RiKey2Line },
      { href: "/settings/mcp", label: "MCP", icon: RiArchiveLine },
    ],
  },
  {
    label: "Other",
    items: [{ href: "/", label: "About", icon: RiInformationLine }],
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/chat") {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-zinc-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-[#eef0f3] lg:block">
        <div className="flex h-full flex-col">
          <Link href="/" className="flex h-16 items-center gap-3 px-5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-black text-white">
              <RiRobot2Line aria-hidden className="size-5" />
            </span>
            <span className="truncate text-sm font-semibold text-zinc-900">Fusion</span>
          </Link>

          <nav className="flex flex-1 flex-col gap-5 px-2">
            {navGroups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <span className="px-3 text-xs font-medium text-zinc-400">{group.label}</span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-950",
                        active && "bg-zinc-200 text-zinc-950",
                      )}
                    >
                      <Icon aria-hidden className="size-4 text-zinc-500" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="border-t border-zinc-200 p-2">
            <div className="flex items-center gap-2">
              <Link href="/chat" className="flex h-9 flex-1 items-center gap-2 rounded-md bg-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:text-zinc-950">
                <RiRobot2Line aria-hidden className="size-4" />
                Back to Chat
              </Link>
              <button type="button" aria-label="Appearance" className="flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950">
                <RiMoonLine aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <div className="flex min-h-screen flex-col">
          <div className="flex h-14 items-center gap-2 border-b border-zinc-200 bg-[#eef0f3] px-4 lg:hidden">
            <Link href="/" className="text-sm font-semibold">
              Fusion
            </Link>
            <nav className="ml-auto flex gap-1 overflow-x-auto">
              {navGroups[0].items.slice(0, 5).map((item) => (
                <Link key={item.href} href={item.href} className="rounded-md px-2 py-1 text-xs text-zinc-500">
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
