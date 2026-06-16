import { RiShieldCheckLine } from "@remixicon/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Metric, PageHeader, Section } from "@/components/product-ui";

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Access" description="Fusion Harness expects Cloudflare Access in front of the web and API Workers." />
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Identity" value="Cloudflare Access" detail="User email is read from Access headers" />
        <Metric label="Local Dev" value="Dev headers" detail="x-fusion-dev-email is accepted locally" />
        <Metric label="Default Role" value="Developer" detail="Created on first API request" />
      </div>
      <Section>
        <Button asChild>
          <Link href="/dashboard">
            <RiShieldCheckLine aria-hidden data-icon="inline-start" />
            Continue
          </Link>
        </Button>
      </Section>
    </div>
  );
}
