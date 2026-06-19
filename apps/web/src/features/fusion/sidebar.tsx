import { MessageSquarePlus, Plus } from "lucide-react";
import type { FusionChat } from "./types";
import { cn } from "@/lib/utils";

type SidebarProps = {
  chats: FusionChat[];
  activeChatId: string | null;
  loading: boolean;
  onNewFusion: () => void;
  onSelectChat: (chatId: string) => void;
};

export function Sidebar({ chats, activeChatId, loading, onNewFusion, onSelectChat }: SidebarProps) {
  return (
    <aside className="flex w-[250px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="p-3">
        <button
          onClick={onNewFusion}
          className="flex w-full items-center gap-2 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
        >
          <Plus aria-hidden className="size-4" />
          New Fusion
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <p className="px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Previous Fusions
        </p>
        {loading ? (
          <div className="flex flex-col gap-1 px-2 py-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <p className="px-3 py-4 text-[13px] text-muted-foreground">No fusions yet.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors duration-150",
                  activeChatId === chat.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <MessageSquarePlus aria-hidden className="size-3.5 shrink-0 opacity-60" />
                <span className="flex-1 truncate text-[13px]">{chat.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}