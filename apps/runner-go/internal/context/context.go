// Package context gathers a compact project-context bundle from a workspace
// so every model in the fusion pipeline answers grounded in the real
// codebase instead of in the abstract. The gatherer is a sidecar: it runs
// before the panel, costs zero tokens, and if it fails the pipeline
// proceeds without context (the models still run, just with less grounding).
package context

import (
	"strings"
	"time"

	"github.com/asthrix/openfusion/apps/runner-go/internal/workspace"
)

// requestTimeout bounds individual git/filesystem operations during gathering.
const requestTimeout = 2 * time.Second

// Bundle is the gathered project context. It is rendered into a compact
// text block via Render() and capped at MaxTokens by the budget limiter.
type Bundle struct {
	WorkspaceRoot  string
	TechStack      []string
	PackageManager string
	KeyDeps        []string
	Monorepo       []string
	FileTree       string
	KeyFiles       []FileSummary
	GitLog         []string
	Conventions    []string
	// Truncated reports whether the bundle was trimmed to fit the token budget.
	Truncated bool
}

type FileSummary struct {
	Path      string
	LineCount int
	Note      string
}

// Options controls what is gathered and the token budget.
type Options struct {
	// MaxTokens caps the rendered bundle size. ~4 chars per token.
	MaxTokens int
	// TreeDepth limits the file-tree walk depth.
	TreeDepth int
	// GitLogCount is the number of recent commits to read.
	GitLogCount int
	// Timeout bounds the full gather operation.
	Timeout time.Duration
}

func DefaultOptions() Options {
	return Options{
		MaxTokens:   4000,
		TreeDepth:   3,
		GitLogCount: 5,
		Timeout:     2 * time.Second,
	}
}

// Gather collects a project-context bundle from the workspace. It never
// returns an error: on any failure it returns a partial bundle so the
// pipeline can proceed. It respects the workspace boundary and never reads
// secrets (.env, .dev.vars, credential files).
func Gather(root string, opts Options) Bundle {
	if strings.TrimSpace(root) == "" {
		return Bundle{}
	}
	if opts.MaxTokens <= 0 {
		opts = DefaultOptions()
	}

	bundle := Bundle{WorkspaceRoot: root}

	// Each gather step is independent and defensive. A failure in one step
	// does not prevent the others from running.
	bundle.TechStack, bundle.PackageManager, bundle.KeyDeps, bundle.Monorepo = detectStack(root)
	bundle.FileTree = gatherFileTree(root, opts.TreeDepth)
	bundle.KeyFiles = gatherKeyFiles(root)
	bundle.GitLog = gatherGitLog(root, opts.GitLogCount)
	bundle.Conventions = detectConventions(root)

	rendered := Render(bundle)
	if approxTokens(rendered) > opts.MaxTokens {
		bundle = trimToBudget(bundle, opts.MaxTokens)
		bundle.Truncated = true
	}
	return bundle
}

// Render formats the bundle as a compact text block suitable for prompt
// injection.
func Render(b Bundle) string {
	var parts []string

	parts = append(parts, "PROJECT CONTEXT:")

	if b.WorkspaceRoot != "" {
		parts = append(parts, "- Workspace root: "+b.WorkspaceRoot)
	}
	if len(b.TechStack) > 0 {
		parts = append(parts, "- Tech stack: "+strings.Join(b.TechStack, ", "))
	}
	if b.PackageManager != "" {
		parts = append(parts, "- Package manager: "+b.PackageManager)
	}
	if len(b.KeyDeps) > 0 {
		parts = append(parts, "- Key dependencies: "+strings.Join(b.KeyDeps, ", "))
	}
	if len(b.Monorepo) > 0 {
		parts = append(parts, "- Monorepo: "+strings.Join(b.Monorepo, ", "))
	}

	if b.FileTree != "" {
		parts = append(parts, "", "FILE TREE (depth-limited, gitignored):")
		parts = append(parts, b.FileTree)
	}

	if len(b.KeyFiles) > 0 {
		parts = append(parts, "", "KEY FILES:")
		for _, f := range b.KeyFiles {
			note := f.Note
			if note != "" {
				note = " — " + note
			}
			parts = append(parts, "- "+f.Path+" ("+itoa(f.LineCount)+" lines)"+note)
		}
	}

	if len(b.GitLog) > 0 {
		parts = append(parts, "", "RECENT GIT HISTORY:")
		for _, line := range b.GitLog {
			parts = append(parts, "- "+line)
		}
	}

	if len(b.Conventions) > 0 {
		parts = append(parts, "", "CONVENTIONS (detected):")
		for _, c := range b.Conventions {
			parts = append(parts, "- "+c)
		}
	}

	if b.Truncated {
		parts = append(parts, "", "(context truncated to fit token budget)")
	}

	return strings.Join(parts, "\n")
}

// IsWithinRoot is re-exported for the context package's security checks.
func IsWithinRoot(root, candidate string) bool {
	return workspace.IsWithinRoot(root, candidate)
}

func approxTokens(text string) int {
	return len(text) / 4
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	if n < 0 {
		return "-" + itoa(-n)
	}
	digits := ""
	for n > 0 {
		digits = string(rune('0'+n%10)) + digits
		n /= 10
	}
	return digits
}

// trimToBudget drops the most expensive sections first to fit the token
// budget. Order of dropping: key files (largest), then file tree, then git
// log. Tech stack and conventions are always kept (small, high-value).
func trimToBudget(b Bundle, maxTokens int) Bundle {
	for approxTokens(Render(b)) > maxTokens {
		if len(b.KeyFiles) > 0 {
			b.KeyFiles = b.KeyFiles[:len(b.KeyFiles)/2]
			continue
		}
		if b.FileTree != "" {
			b.FileTree = truncateTree(b.FileTree, maxTokens/2)
			if b.FileTree == "" {
				continue
			}
			break
		}
		if len(b.GitLog) > 0 {
			b.GitLog = b.GitLog[:len(b.GitLog)/2]
			continue
		}
		break
	}
	return b
}

func truncateTree(tree string, maxChars int) string {
	if len(tree) <= maxChars {
		return tree
	}
	cut := tree[:maxChars]
	if idx := strings.LastIndex(cut, "\n"); idx > 0 {
		cut = cut[:idx]
	}
	return cut + "\n... (truncated)"
}
