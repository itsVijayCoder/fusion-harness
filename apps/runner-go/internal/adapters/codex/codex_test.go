package codex

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestListModelsReturnsCuratedFallbacks(t *testing.T) {
	dir := t.TempDir()
	writeExecutable(t, dir, "codex")
	t.Setenv("PATH", "")

	models, err := (Adapter{ToolDirs: []string{dir}}).ListModels(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	ids := map[string]string{}
	for _, model := range models {
		ids[model.ID] = model.Source
	}

	expected := []string{
		"codex/gpt-5.5",
		"codex/gpt-5.4",
		"codex/gpt-5.4-mini",
		"codex/gpt-5.3-codex",
		"codex/gpt-5.1",
		"codex/gpt-5.1-codex-mini",
		"codex/gpt-5-codex",
		"codex/gpt-5",
		"codex/o3",
		"codex/o4-mini",
	}
	for _, id := range expected {
		if ids[id] != "fallback" {
			t.Fatalf("expected fallback model %s, got source %q", id, ids[id])
		}
	}
}

func writeExecutable(t *testing.T, dir string, name string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte("#!/bin/sh\nprintf 'codex 0.0.0\\n'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}
