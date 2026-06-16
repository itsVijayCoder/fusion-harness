import type { PermissionProfile } from "@fusion-harness/shared";

export type PermissionDecision = "allow" | "ask" | "deny";

export type PermissionPolicy = {
  profile: PermissionProfile;
  filesystemWrite: PermissionDecision;
  shell: PermissionDecision;
  network: PermissionDecision;
  allowedCommands: string[];
  docker: {
    privileged: false;
    network: "none";
    denyDockerSocket: true;
    denySecretMounts: true;
  };
};

const trustedCommandAllowlist = ["git status", "git diff *", "npm test", "pnpm test", "pnpm build", "go test ./...", "pytest"] as const;

export function resolvePermissionPolicy(profile: PermissionProfile): PermissionPolicy {
  switch (profile) {
    case "trusted_internal":
      return withDockerDefaults({
        profile,
        filesystemWrite: "allow",
        shell: "allow",
        network: "ask",
        allowedCommands: [...trustedCommandAllowlist],
      });
    case "workspace_write":
      return withDockerDefaults({ profile, filesystemWrite: "allow", shell: "ask", network: "ask", allowedCommands: [] });
    case "readonly":
      return withDockerDefaults({ profile, filesystemWrite: "deny", shell: "deny", network: "deny", allowedCommands: [] });
  }
}

export function isCommandAllowed(policy: PermissionPolicy, command: string) {
  if (policy.shell === "deny") return false;
  if (policy.shell === "ask") return false;

  return policy.allowedCommands.some((allowed) => matchesCommandPattern(allowed, command));
}

function withDockerDefaults(policy: Omit<PermissionPolicy, "docker">): PermissionPolicy {
  return {
    ...policy,
    docker: {
      privileged: false,
      network: "none",
      denyDockerSocket: true,
      denySecretMounts: true,
    },
  };
}

function matchesCommandPattern(pattern: string, command: string) {
  if (pattern.endsWith(" *")) {
    return command.startsWith(pattern.slice(0, -2));
  }

  return command === pattern;
}
