package discovery

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectCommandReportsUnavailable(t *testing.T) {
	result := DetectCommand("definitely-not-a-fusion-harness-command")
	if result.Found {
		t.Fatalf("expected command to be unavailable")
	}
	if result.Status != "unavailable" {
		t.Fatalf("expected unavailable status, got %q", result.Status)
	}
}

func TestDetectCommandWithLookupPrefersPrimaryBinary(t *testing.T) {
	dir := t.TempDir()
	fallbackPath := writeExecutable(t, dir, "opencode")
	primaryPath := writeExecutable(t, dir, "opencode-cli")
	t.Setenv("PATH", dir)

	result := DetectCommandWithLookup(CommandLookup{
		Name:             "opencode",
		Binary:           "opencode-cli",
		FallbackBinaries: []string{"opencode"},
	})

	if !result.Found {
		t.Fatalf("expected command to be found: %s", result.Error)
	}
	if result.Path != primaryPath {
		t.Fatalf("expected primary binary %q, got %q; fallback was %q", primaryPath, result.Path, fallbackPath)
	}
	if result.Tool != "opencode" {
		t.Fatalf("expected stable tool name opencode, got %q", result.Tool)
	}
}

func TestDetectCommandWithLookupUsesAbsoluteOverride(t *testing.T) {
	dir := t.TempDir()
	overridePath := writeExecutable(t, dir, "custom-codex")
	t.Setenv("PATH", "")
	t.Setenv("CODEX_BIN", overridePath)

	result := DetectCommandWithLookup(CommandLookup{Name: "codex", Binary: "codex", EnvOverride: "CODEX_BIN"})

	if !result.Found {
		t.Fatalf("expected override to be found: %s", result.Error)
	}
	if result.Path != overridePath {
		t.Fatalf("expected override path %q, got %q", overridePath, result.Path)
	}
	if result.Metadata["override_env"] != "CODEX_BIN" {
		t.Fatalf("expected override metadata, got %#v", result.Metadata)
	}
}

func TestDetectCommandWithLookupRejectsRelativeOverride(t *testing.T) {
	t.Setenv("CODEX_BIN", "codex")

	result := DetectCommandWithLookup(CommandLookup{Name: "codex", Binary: "codex", EnvOverride: "CODEX_BIN"})

	if result.Found {
		t.Fatalf("expected relative override to be rejected")
	}
	if result.Status != "unavailable" {
		t.Fatalf("expected unavailable status, got %q", result.Status)
	}
}

func TestDetectCommandWithLookupSearchesExtraDirs(t *testing.T) {
	dir := t.TempDir()
	binaryPath := writeExecutable(t, dir, "opencode-cli")
	t.Setenv("PATH", "")

	result := DetectCommandWithLookup(CommandLookup{Name: "opencode", Binary: "opencode-cli", ExtraDirs: []string{dir}})

	if !result.Found {
		t.Fatalf("expected command in extra dir to be found: %s", result.Error)
	}
	if result.Path != binaryPath {
		t.Fatalf("expected %q, got %q", binaryPath, result.Path)
	}
	if result.Metadata["source"] != "extra_dir" {
		t.Fatalf("expected extra_dir source metadata, got %#v", result.Metadata)
	}
}

func writeExecutable(t *testing.T, dir string, name string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}
