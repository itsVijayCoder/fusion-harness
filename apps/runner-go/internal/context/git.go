package context

import (
	"context"
	"os/exec"
	"strings"
)

// gatherGitLog reads the most recent N commits as oneline summaries. Fast,
// no LLM. Returns empty if git is unavailable or the workspace is not a
// repository.
func gatherGitLog(root string, count int) []string {
	if count <= 0 {
		count = 5
	}
	ctx, cancel := context.WithTimeout(context.Background(), requestTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "-C", root, "log", "--oneline", "-n", itoa(count))
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var result []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			result = append(result, line)
		}
	}
	return result
}
