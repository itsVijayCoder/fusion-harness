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

func TestRunPreservesUserEnvironment(t *testing.T) {
	root := t.TempDir()
	command := writeExecutable(t, root, "env-check", "#!/bin/sh\nprintf '%s' \"$FUSION_HOST_TEST_KEY\"\n")
	t.Setenv("FUSION_HOST_TEST_KEY", "available-to-native-cli")

	result, err := Run(context.Background(), CommandSpec{
		Name:         command,
		WorkingDir:   root,
		AllowedRoots: []string{root},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Stdout != "available-to-native-cli" {
		t.Fatalf("expected user environment to be available, got %q", result.Stdout)
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

func TestRunStreamingInvokesCallbackPerLine(t *testing.T) {
	root := t.TempDir()
	script := "#!/bin/sh\nprintf 'line one\\nline two\\nline three\\n'\n"
	command := writeExecutable(t, root, "multi-line", script)

	var chunks []OutputChunk
	result, err := RunStreaming(context.Background(), CommandSpec{
		Name:         command,
		WorkingDir:   root,
		AllowedRoots: []string{root},
	}, func(chunk OutputChunk) {
		chunks = append(chunks, chunk)
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Stdout != "line one\nline two\nline three\n" {
		t.Fatalf("expected full stdout buffer, got %q", result.Stdout)
	}
	if len(chunks) != 3 {
		t.Fatalf("expected 3 streamed chunks, got %d: %v", len(chunks), chunks)
	}
	want := []string{"line one", "line two", "line three"}
	for i, c := range chunks {
		if c.Stream != "stdout" {
			t.Fatalf("chunk %d stream = %q, want stdout", i, c.Stream)
		}
		if c.Text != want[i] {
			t.Fatalf("chunk %d text = %q, want %q", i, c.Text, want[i])
		}
	}
}

func TestRunStreamingNilCallbackFallsBackToRun(t *testing.T) {
	root := t.TempDir()
	command := writeExecutable(t, root, "echo", "#!/bin/sh\nprintf 'hello\\n'")

	result, err := RunStreaming(context.Background(), CommandSpec{
		Name:         command,
		WorkingDir:   root,
		AllowedRoots: []string{root},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if result.Stdout != "hello\n" {
		t.Fatalf("expected hello\\n, got %q", result.Stdout)
	}
}

func TestRunStreamingCapturesStderr(t *testing.T) {
	root := t.TempDir()
	command := writeExecutable(t, root, "err-out", "#!/bin/sh\nprintf 'err line\\n' 1>&2")

	var chunks []OutputChunk
	result, err := RunStreaming(context.Background(), CommandSpec{
		Name:         command,
		WorkingDir:   root,
		AllowedRoots: []string{root},
	}, func(chunk OutputChunk) {
		chunks = append(chunks, chunk)
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Stderr != "err line\n" {
		t.Fatalf("expected stderr buffer, got %q", result.Stderr)
	}
	if len(chunks) != 1 || chunks[0].Stream != "stderr" || chunks[0].Text != "err line" {
		t.Fatalf("expected one stderr chunk, got %v", chunks)
	}
}
