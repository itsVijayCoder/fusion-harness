#!/usr/bin/env bash
set -Eeuo pipefail

label="com.asthrix.fusion-runner"

usage() {
  cat <<'USAGE'
Usage: scripts/uninstall-runner-macos.sh [options]

Stops the Fusion Runner LaunchAgent, deregisters it from the Fusion API, and
removes the local binary, config, and logs.

Options:
  --cloud-url URL   Fusion API URL. Defaults to the URL stored in the runner
                    config, or https://fusion-api.asthrix.workers.dev.
  --token TOKEN     Runner token used to authenticate the deregister call.
                    Defaults to the token stored in the runner config.
  --keep-files      Only stop the service and deregister; leave local files.
  --skip-api        Only remove local files; do not call the deregister API.
  -h, --help        Show this help.
USAGE
}

cloud_url=""
token=""
keep_files=0
skip_api=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cloud-url)
      cloud_url="${2:-}"
      shift 2
      ;;
    --token)
      token="${2:-}"
      shift 2
      ;;
    --keep-files)
      keep_files=1
      shift
      ;;
    --skip-api)
      skip_api=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This uninstaller is for macOS." >&2
  exit 1
fi

uid="$(id -u)"
plist_path="$HOME/Library/LaunchAgents/$label.plist"
config_dir="$HOME/.openfusion"
legacy_config_dir="$HOME/.fusion-harness"
config_path="$config_dir/config.json"
legacy_config_path="$legacy_config_dir/config.json"
binary_path="$config_dir/bin/fusion-runner"
symlink_path="$HOME/.local/bin/fusion-runner"
log_dir="$config_dir/logs"

# 1. Stop and remove the LaunchAgent first so the runner cannot re-register
#    while we are tearing it down.
launchctl bootout "gui/$uid" "$plist_path" >/dev/null 2>&1 || true
rm -f "$plist_path"

# 2. Resolve runner config. Prefer ~/.openfusion/config.json, then fall back to
#    the legacy ~/.fusion-harness/config.json used by older runner builds.
resolved_config=""
for candidate in "$config_path" "$legacy_config_path"; do
  if [[ -f "$candidate" ]]; then
    resolved_config="$candidate"
    break
  fi
done

runner_id=""
config_cloud_url=""
config_token=""
if [[ -n "$resolved_config" ]]; then
  # Parse with python3 if available, otherwise fall back to grep/sed.
  if command -v python3 >/dev/null 2>&1; then
    runner_id="$(python3 -c "import json,sys; d=json.load(open('$resolved_config')); print(d.get('runner_id') or '')" 2>/dev/null || true)"
    config_cloud_url="$(python3 -c "import json,sys; d=json.load(open('$resolved_config')); print(d.get('cloud_url') or '')" 2>/dev/null || true)"
    config_token="$(python3 -c "import json,sys; d=json.load(open('$resolved_config')); print(d.get('token') or '')" 2>/dev/null || true)"
  else
    runner_id="$(grep -oE '\"runner_id\"[[:space:]]*:[[:space:]]*\"[^\"]*\"' "$resolved_config" | sed -E 's/.*: *\"([^\"]*)\".*/\1/' || true)"
    config_cloud_url="$(grep -oE '\"cloud_url\"[[:space:]]*:[[:space:]]*\"[^\"]*\"' "$resolved_config" | sed -E 's/.*: *\"([^\"]*)\".*/\1/' || true)"
    config_token="$(grep -oE '\"token\"[[:space:]]*:[[:space:]]*\"[^\"]*\"' "$resolved_config" | sed -E 's/.*: *\"([^\"]*)\".*/\1/' || true)"
  fi
fi

if [[ -z "$cloud_url" ]]; then
  cloud_url="${config_cloud_url:-https://fusion-api.asthrix.workers.dev}"
fi
if [[ -z "$token" ]]; then
  token="$config_token"
fi

# 3. Deregister the runner from the API so it stops showing up in /runners.
if [[ "$skip_api" -eq 0 && -n "$runner_id" ]]; then
  if [[ -z "$token" ]]; then
    echo "No runner token found in config; skipping API deregister." >&2
  else
    echo "Deregistering runner $runner_id from $cloud_url ..."
    status="$(curl -sS -o /dev/null -w '%{http_code}' \
      -X DELETE \
      -H "authorization: Bearer $token" \
      "${cloud_url%/}/api/runners/$(printf '%s' "$runner_id" | python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe=""))' 2>/dev/null || printf '%s' "$runner_id")" \
      2>/dev/null || true)"
    if [[ "$status" == "200" ]]; then
      echo "Runner deregistered from the API."
    elif [[ -n "$status" ]]; then
      echo "API deregister returned HTTP $status (the runner row may already be gone)." >&2
    else
      echo "Could not reach the Fusion API; the runner row will need to be removed manually." >&2
    fi
  fi
elif [[ "$skip_api" -eq 0 && -z "$runner_id" ]]; then
  echo "No runner config found; skipping API deregister." >&2
fi

# 4. Remove local files. Always remove unless --keep-files was passed.
if [[ "$keep_files" -eq 0 ]]; then
  rm -f "$binary_path"
  rm -f "$symlink_path"
  rm -f "$config_path"
  rm -f "$legacy_config_path"
  rm -f "$log_dir/runner.out.log" "$log_dir/runner.err.log" "$log_dir/bootstrap.err.log"
  # Remove the legacy config directory if it is now empty.
  if [[ -d "$legacy_config_dir" ]]; then
    rmdir "$legacy_config_dir" 2>/dev/null || true
  fi
fi

echo "Fusion Runner removed."
if [[ "$keep_files" -eq 0 ]]; then
  echo "Removed: LaunchAgent, binary, config, and logs."
else
  echo "Kept local files per --keep-files."
fi