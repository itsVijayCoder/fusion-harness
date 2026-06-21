import type { GitHubPrReviewDetail } from "@fusion-harness/shared";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataNotice, EmptyState, PageHeader, Section, StatusPill } from "@/components/product-ui";
import { apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type DetailResponse = GitHubPrReviewDetail;

export default async function PrReviewDetailPage({
  params,
}: {
  params: Promise<{ prId: string }>;
}) {
  const { prId } = await params;
  const detail = await apiGet<DetailResponse>(`/api/pr-reviews/${prId}`, null as unknown as DetailResponse);

  if (!detail.data) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="PR Review" description="Pull request detail" />
        <EmptyState
          title="Pull request not found"
          description="This PR may have been closed or not yet synced."
        />
        <Button asChild variant="secondary" size="sm" className="self-start">
          <Link href="/pr-reviews">Back to queue</Link>
        </Button>
      </div>
    );
  }

  const pr = detail.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`#${pr.number} ${pr.title}`}
        description={`${pr.repo.fullName} · ${pr.baseRef} ← ${pr.headRef}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/pr-reviews">Back to queue</Link>
            </Button>
            {pr.htmlUrl ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pr.htmlUrl} target="_blank" rel="noreferrer">
                  View on GitHub
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <DataNotice source={detail.source} error={detail.error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
          <div className="mt-2">
            <StatusPill value={pr.status} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Author</p>
          <p className="mt-2 text-sm font-medium">{pr.authorLogin ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Head SHA</p>
          <p className="mt-2 font-mono text-xs">{pr.headSha.slice(0, 12)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Changed Files</p>
          <p className="mt-2 text-sm font-medium">{pr.changedFiles ?? "—"}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Review Runs">
          {pr.reviewRuns.length ? (
            <div className="divide-y divide-border rounded-lg border border-border">
              {pr.reviewRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{run.reviewMode} review</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(run.createdAt)}</p>
                    {run.summary ? (
                      <p className="mt-1 text-xs text-muted-foreground">{run.summary}</p>
                    ) : null}
                    {run.error ? (
                      <p className="mt-1 text-xs text-destructive">{run.error}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill value={run.status} />
                    {run.riskLevel ? <StatusPill value={run.riskLevel} /> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No review runs yet"
              description="Start a review to generate draft comments using the local agent."
            />
          )}
        </Section>

        <Section title="Review Subjects">
          {pr.subjects.length ? (
            <div className="divide-y divide-border rounded-lg border border-border">
              {pr.subjects.map((subject) => (
                <div key={subject.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <div>
                    <p className="font-medium">{subject.githubLogin}</p>
                    <p className="text-xs text-muted-foreground">{subject.subjectType}</p>
                  </div>
                  <StatusPill value={subject.state} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No review subjects"
              description="No assignees or requested reviewers are mapped to this PR."
            />
          )}
        </Section>
      </div>

      <Section title="Draft Comments">
        {pr.comments.length ? (
          <div className="divide-y divide-border rounded-lg border border-border">
            {pr.comments.map((comment) => (
              <div key={comment.id} className="p-4 text-sm">
                <div className="flex items-center gap-2">
                  <StatusPill value={comment.severity} />
                  <StatusPill value={comment.category} />
                  <StatusPill value={comment.status} />
                  <span className="font-mono text-xs text-muted-foreground">{comment.filePath}</span>
                  {comment.line ? (
                    <span className="text-xs text-muted-foreground">:{comment.line}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-muted-foreground">{comment.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No draft comments"
            description="Run a review to generate draft comments for this pull request."
          />
        )}
      </Section>
    </div>
  );
}