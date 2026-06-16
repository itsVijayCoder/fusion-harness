import { RiGitBranchLine, RiRobot2Line } from "@remixicon/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Metric, PageHeader, Section } from "@/components/product-ui";

export default function Home() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Fusion Harness"
        description="Cloud control plane, local runner execution, fused model traces, and auditable coding workflows."
        actions={
          <>
            <Button asChild>
              <Link href="/chat">
                <RiRobot2Line aria-hidden data-icon="inline-start" />
                New run
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/runners">
                <RiGitBranchLine aria-hidden data-icon="inline-start" />
                Runners
              </Link>
            </Button>
          </>
        }
      />
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Control plane" value="Cloudflare" detail="Workers, D1, Durable Objects, R2, KV, Workflows" />
          <Metric label="Execution plane" value="Go runner" detail="OpenCode, Codex, host executor, Docker executor" />
          <Metric label="Default policy" value="Readonly" detail="Workspace writes and commands require explicit policy" />
        </div>
      </Section>
    </div>
  );
}
