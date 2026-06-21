import type { GitHubPrReviewQueueItem } from "@fusion-harness/shared";
import Link from "next/link";
import { DataNotice, EmptyState, PageHeader, Section, StatusPill } from "@/components/product-ui";
import { apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type QueueResponse = { data: GitHubPrReviewQueueItem[] };

const statusFilters: Array<{ label: string; value: string }> = [
  { label: "All", value: "" },
  { label: "Not assigned", value: "not_assigned" },
  { label: "Assigned", value: "assigned" },
  { label: "Pending", value: "pending" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Stale", value: "stale" },
  { label: "Failed", value: "failed" },
  { label: "Ignored", value: "ignored" },
];

export default async function PrReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const query = statusFilter ? `?status=${statusFilter}&limit=100` : "?limit=100";

  const queue = await apiGet<QueueResponse>(`/api/pr-reviews${query}`, { data: [] });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="PR Reviews"
        description="Pull requests assigned to or requesting review from mapped Fusion users. Drafts are generated locally and published after human approval."
      />
      <DataNotice source={queue.source} error={queue.error} />

      <Section title="Filters">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const active = filter.value === statusFilter;
            const href = filter.value ? `/pr-reviews?status=${filter.value}` : "/pr-reviews";
            return (
              <Link
                key={filter.label}
                href={href}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </Section>

      <Section title="Pull Request Queue">
        {queue.data.data.length ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Repository</th>
                  <th className="px-4 py-3 font-medium">PR</th>
                  <th className="px-4 py-3 font-medium">Author</th>
                  <th className="px-4 py-3 font-medium">Reviewer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Review</th>
                  <th className="px-4 py-3 font-medium">Head SHA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.data.data.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{item.repoFullName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/pr-reviews/${item.id}`}
                        className="text-primary hover:underline"
                      >
                        <span className="font-medium">#{item.number}</span>{" "}
                        <span className="text-muted-foreground">{item.title}</span>
                      </Link>
                      {item.draft ? (
                        <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                          Draft
                        </span>
                      ) : null}
                      {item.isFork ? (
                        <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                          Fork
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.authorLogin ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.reviewSubject ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill value={item.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.lastReviewRun
                        ? formatDateTime(item.lastReviewRun.completedAt ?? item.lastReviewRun.createdAt)
                        : "No review yet"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {item.headSha.slice(0, 7)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No pull requests found"
            description="Install the Fusion GitHub App, request a review from a mapped user, and sync to populate the queue."
          />
        )}
      </Section>
    </div>
  );
}