package context

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGatherEmptyRoot(t *testing.T) {
	b := Gather("", DefaultOptions())
	if b.WorkspaceRoot != "" {
		t.Fatalf("expected empty bundle for empty root, got %+v", b)
	}
}

func TestGatherRealWorkspace(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, "package.json", `{"name":"demo","dependencies":{"next":"16.0.0","react":"19.0.0"},"devDependencies":{"typescript":"5.7.0"}}`)
	writeFile(t, root, "README.md", "# Demo\nA demo project.")
	writeFile(t, root, "src/index.ts", "console.log('hi');\n")
	mkdir(t, root, "node_modules")
	writeFile(t, root, "node_modules/pkg/index.js", "module.exports = {};")

	b := Gather(root, DefaultOptions())
	rendered := Render(b)

	if !strings.Contains(rendered, "PROJECT CONTEXT:") {
		t.Fatalf("rendered bundle missing header")
	}
	if !strings.Contains(rendered, "TypeScript") {
		t.Fatalf("rendered bundle missing TypeScript stack detection")
	}
	if !strings.Contains(rendered, "Next.js") {
		t.Fatalf("rendered bundle missing Next.js detection")
	}
	if !strings.Contains(rendered, "npm") {
		t.Fatalf("rendered bundle missing npm package manager")
	}
	if !strings.Contains(rendered, "index.ts") {
		t.Fatalf("rendered bundle missing source file in tree")
	}
	if strings.Contains(rendered, "node_modules") {
		t.Fatalf("rendered bundle should exclude node_modules")
	}
	if !strings.Contains(rendered, "README.md") {
		t.Fatalf("rendered bundle missing README key file")
	}
}

func TestGatherRespectsGitignore(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, ".gitignore", "secrets/\n*.env\n")
	writeFile(t, root, "src/app.ts", "export {};\n")
	mkdir(t, root, "secrets")
	writeFile(t, root, "secrets/key.txt", "SECRET=abc")

	b := Gather(root, DefaultOptions())
	rendered := Render(b)
	if strings.Contains(rendered, "secrets") {
		t.Fatalf("rendered bundle should exclude gitignored secrets dir: %s", rendered)
	}
	if !strings.Contains(rendered, "app.ts") {
		t.Fatalf("rendered bundle missing src/app.ts")
	}
}

func TestGatherGoModule(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, "go.mod", "module example.com/demo\n\ngo 1.24\n\nrequire (\n\tgithub.com/foo/bar v1.2.3\n)\n")
	b := Gather(root, DefaultOptions())
	found := false
	for _, s := range b.TechStack {
		if s == "Go" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected Go in tech stack, got %v", b.TechStack)
	}
}

func TestGatherBudgetTruncates(t *testing.T) {
	root := t.TempDir()
	// Create many files to force the file tree to exceed a tiny budget.
	for i := 0; i < 200; i++ {
		writeFile(t, root, "dir"+itoa(i)+"/file.ts", "export const x = "+itoa(i)+";\n")
	}
	writeFile(t, root, "package.json", `{"name":"demo"}`)

	opts := DefaultOptions()
	opts.MaxTokens = 100
	b := Gather(root, opts)
	if !b.Truncated {
		t.Fatalf("expected bundle to be truncated for small budget")
	}
	if approxTokens(Render(b)) > opts.MaxTokens*4 {
		t.Fatalf("truncated bundle far exceeds budget: %d tokens", approxTokens(Render(b)))
	}
}

func TestRenderEmptyBundle(t *testing.T) {
	out := Render(Bundle{})
	if !strings.Contains(out, "PROJECT CONTEXT:") {
		t.Fatalf("empty bundle should still render header")
	}
}

func TestGatherNeverPanicsOnMissingDir(t *testing.T) {
	b := Gather(filepath.Join(t.TempDir(), "does-not-exist"), DefaultOptions())
	_ = Render(b)
}

func writeFile(t *testing.T, root, path, content string) {
	t.Helper()
	full := filepath.Join(root, path)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func mkdir(t *testing.T, root, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(root, path), 0o755); err != nil {
		t.Fatal(err)
	}
}
