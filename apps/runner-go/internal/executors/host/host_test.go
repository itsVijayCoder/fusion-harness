package host

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestRunBlocksWorkingDirOutsideAllowedRoots(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "outside")

	_, err := Run(context.Background(), CommandSpec{
		Name:         "echo",
		Args:         []string{"hello"},
		WorkingDir:   outside,
		AllowedRoots: []string{root},
	})
	if err == nil {
		t.Fatalf("expected outside workspace to be blocked")
	}
}

func TestRunWritesStdin(t *testing.T) {
	root := t.TempDir()
	command := writeExecutable(t, root, "stdin-echo", "#!/bin/sh\ncat\n")

	result, err := Run(context.Background(), CommandSpec{
		Name:         command,
		Stdin:        "hello from stdin",
		WorkingDir:   root,
		AllowedRoots: []string{root},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Stdout != "hello from stdin" {
		t.Fatalf("expected stdin to be echoed, got %q", result.Stdout)
	}
}

func writeExecutable(t *testing.T, dir string, name string, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}
