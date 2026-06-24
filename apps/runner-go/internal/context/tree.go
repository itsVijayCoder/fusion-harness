package context

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// defaultExcludes are directories that are never useful as context and are
// always excluded from the file-tree walk, regardless of .gitignore.
var defaultExcludes = map[string]bool{
	"node_modules": true,
	".git":         true,
	"dist":         true,
	"build":        true,
	".next":        true,
	".open-next":   true,
	".wrangler":    true,
	".vercel":      true,
	"coverage":     true,
	".DS_Store":    true,
}

// gatherFileTree walks the workspace up to maxDepth, excluding gitignored
// and default-ignored directories. Returns a compact indented tree.
func gatherFileTree(root string, maxDepth int) string {
	if maxDepth <= 0 {
		maxDepth = 3
	}

	ignore := loadGitignore(root)
	var lines []string

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if path == root {
			return nil
		}

		rel, relErr := filepath.Rel(root, path)
		if relErr != nil {
			return nil
		}
		name := d.Name()

		if d.IsDir() {
			if defaultExcludes[name] {
				return filepath.SkipDir
			}
			if ignore.matches(rel) {
				return filepath.SkipDir
			}
			depth := strings.Count(rel, string(filepath.Separator)) + 1
			if depth > maxDepth {
				return filepath.SkipDir
			}
			lines = append(lines, indent(depth)+name+"/")
			return nil
		}

		if ignore.matches(rel) {
			return nil
		}
		depth := strings.Count(rel, string(filepath.Separator)) + 1
		if depth > maxDepth {
			return nil
		}
		lines = append(lines, indent(depth)+name)
		return nil
	})
	if err != nil {
		return strings.Join(lines, "\n")
	}

	if len(lines) > 400 {
		lines = lines[:400]
	}
	return strings.Join(lines, "\n")
}

func indent(depth int) string {
	return strings.Repeat("  ", depth)
}

// gitignore is a minimal .gitignore matcher. It supports simple patterns
// (directory names, globs with *) and negation (!). It is not a full git
// implementation — it covers the common cases that matter for context
// gathering.
type gitignore struct {
	patterns []gitignorePattern
}

type gitignorePattern struct {
	negate  bool
	pattern string
	dirOnly bool
}

func loadGitignore(root string) *gitignore {
	gi := &gitignore{}
	data, err := os.ReadFile(filepath.Join(root, ".gitignore"))
	if err != nil {
		return gi
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		p := gitignorePattern{}
		if strings.HasPrefix(line, "!") {
			p.negate = true
			line = line[1:]
		}
		if strings.HasSuffix(line, "/") {
			p.dirOnly = true
			line = strings.TrimSuffix(line, "/")
		}
		p.pattern = line
		gi.patterns = append(gi.patterns, p)
	}
	return gi
}

func (gi *gitignore) matches(rel string) bool {
	rel = filepath.ToSlash(rel)
	matched := false
	for _, p := range gi.patterns {
		if matchPattern(p.pattern, rel) {
			matched = !p.negate
		}
	}
	return matched
}

func matchPattern(pattern, rel string) bool {
	if pattern == rel {
		return true
	}
	// Match any path component
	for _, part := range strings.Split(rel, "/") {
		if pattern == part {
			return true
		}
		if ok, _ := filepath.Match(pattern, part); ok {
			return true
		}
	}
	// Glob against full path
	if ok, _ := filepath.Match(pattern, rel); ok {
		return true
	}
	return false
}

// gatherKeyFiles reads a curated set of high-value files (manifests, configs,
// README) and summarizes them by path + line count. File contents are not
// included in the bundle — only metadata — to keep the token budget tight.
// The prompts reference real files; the models read them via their adapters.
func gatherKeyFiles(root string) []FileSummary {
	candidates := []string{
		"package.json",
		"go.mod",
		"tsconfig.json",
		"wrangler.jsonc",
		"wrangler.toml",
		"Cargo.toml",
		"pyproject.toml",
		"README.md",
		"AGENT.md",
		"CLAUDE.md",
	}

	var summaries []FileSummary
	for _, name := range candidates {
		path := filepath.Join(root, name)
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			continue
		}
		lineCount := countLines(path)
		summaries = append(summaries, FileSummary{
			Path:      name,
			LineCount: lineCount,
			Note:      keyFileNote(name),
		})
	}

	// Also include a few high-value source directories' top files.
	summaries = append(summaries, gatherSourceSummaries(root)...)

	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].Path < summaries[j].Path
	})
	return summaries
}

func keyFileNote(name string) string {
	switch name {
	case "package.json":
		return "npm manifest, dependencies and scripts"
	case "go.mod":
		return "Go module definition"
	case "tsconfig.json":
		return "TypeScript config"
	case "wrangler.jsonc", "wrangler.toml":
		return "Cloudflare Workers config"
	case "Cargo.toml":
		return "Rust manifest"
	case "pyproject.toml":
		return "Python project config"
	case "README.md":
		return "project readme"
	case "AGENT.md":
		return "agent engineering guide"
	case "CLAUDE.md":
		return "agent guide"
	}
	return ""
}

func countLines(path string) int {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	return strings.Count(string(data), "\n") + 1
}

// gatherSourceSummaries looks for a small set of well-known source files in
// common locations to give the models concrete file references.
func gatherSourceSummaries(root string) []FileSummary {
	var summaries []FileSummary
	known := []string{
		"packages/core/src/fusion/prompt-builder.ts",
		"packages/core/src/fusion/judge.ts",
		"apps/runner-go/internal/fusion/runner.go",
		"apps/runner-go/internal/fusion/prompts.go",
		"workers/api/src/services/runs.ts",
	}
	for _, rel := range known {
		path := filepath.Join(root, rel)
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			continue
		}
		summaries = append(summaries, FileSummary{
			Path:      rel,
			LineCount: countLines(path),
		})
	}
	return summaries
}
