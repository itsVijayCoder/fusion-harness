import { RiDownloadLine } from "@remixicon/react";
import type { ArtifactRef } from "@openfusion/shared";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataNotice, Metric, PageHeader, Section } from "@/components/product-ui";
import { apiGet, apiUrl } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type ArtifactPageProps = {
  params: Promise<{ artifactId: string }>;
};

function fallbackArtifact(artifactId: string): ArtifactRef {
  return {
    id: artifactId,
    orgId: "org_dev",
    runId: "run_unknown",
    kind: "log",
    objectKey: "unavailable",
    createdAt: new Date().toISOString(),
  };
}

export default async function ArtifactDetailPage({ params }: ArtifactPageProps) {
  const { artifactId } = await params;
  const artifact = await apiGet<ArtifactRef>(`/api/artifacts/${artifactId}`, fallbackArtifact(artifactId));

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={artifact.data.id}
        description="R2 object metadata, checksum, size, and run linkage."
        actions={
          <Button asChild variant="outline">
            <Link href={apiUrl(`/api/artifacts/${artifact.data.id}?download=1`)}>
              <RiDownloadLine aria-hidden data-icon="inline-start" />
              Download
            </Link>
          </Button>
        }
      />
      <DataNotice source={artifact.source} error={artifact.error} />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Kind" value={artifact.data.kind} />
        <Metric label="Size" value={formatBytes(artifact.data.sizeBytes)} />
        <Metric label="Content Type" value={artifact.data.contentType ?? "unknown"} />
        <Metric label="Created" value={formatDateTime(artifact.data.createdAt)} />
      </div>
      <Section title="Object">
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <dl className="grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Run</dt>
              <dd className="mt-1 font-medium">
                <Link href={`/runs/${artifact.data.runId}`} className="text-primary hover:underline">
                  {artifact.data.runId}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">SHA-256</dt>
              <dd className="mt-1 break-all font-medium">{artifact.data.sha256 ?? "Not recorded"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs text-muted-foreground">Object Key</dt>
              <dd className="mt-1 break-all font-medium">{artifact.data.objectKey}</dd>
            </div>
          </dl>
        </div>
      </Section>
    </div>
  );
}
