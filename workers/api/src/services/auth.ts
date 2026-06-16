export type AccessIdentity = {
  orgId: string;
  orgName: string;
  userId: string;
  email: string;
  name?: string;
};

const devEmail = "developer@fusion.local";

export function requireAccessIdentity(headers: Headers): AccessIdentity {
  const email = headers.get("cf-access-authenticated-user-email") ?? headers.get("x-fusion-dev-email") ?? devEmail;
  const name = headers.get("cf-access-authenticated-user-name") ?? headers.get("x-fusion-dev-name") ?? undefined;
  const orgName = headers.get("x-fusion-org-name") ?? "Fusion Harness Dev";
  const orgId = headers.get("x-fusion-org-id") ?? "org_dev";
  const userId = headers.get("x-fusion-user-id") ?? `usr_${slugify(email)}`;

  return {
    orgId,
    orgName,
    userId,
    email,
    name,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}
