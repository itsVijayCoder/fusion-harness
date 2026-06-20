import { MessageSquarePlus, Plus, Trash2 } from "lucide-react";
import type { FusionChat } from "./types";
import { cn } from "@/lib/utils";

type SidebarProps = {
  chats: FusionChat[];
  activeChatId: string | null;
  loading: boolean;
  onNewFusion: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
};

export function Sidebar({ chats, activeChatId, loading, onNewFusion, onSelectChat, onDeleteChat }: SidebarProps) {
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
              <div
                key={chat.id}
                className={cn(
                  "group flex items-center rounded-lg transition-colors duration-150",
                  activeChatId === chat.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                >
                  <MessageSquarePlus aria-hidden className="size-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate text-[13px]">{chat.title}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${chat.title}`}
                  title="Delete"
                  onClick={() => onDeleteChat(chat.id)}
                  className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
