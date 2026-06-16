package codex

import (
	"context"
	"time"

	"github.com/asthrix/fusion-harness/apps/runner-go/internal/adapters"
	"github.com/asthrix/fusion-harness/apps/runner-go/internal/discovery"
	"github.com/asthrix/fusion-harness/apps/runner-go/internal/executors/host"
)

type Adapter struct {
	AllowedRoots []string
	ToolDirs     []string
}

func (Adapter) ID() string {
	return "codex"
}

func (adapter Adapter) Detect(ctx context.Context) adapters.DetectionResult {
	tool := detect(ctx, adapter.ToolDirs)
	return adapters.DetectionResult{
		Tool:     "codex",
		Found:    tool.Found,
		Path:     tool.Path,
		Version:  tool.Version,
		Status:   tool.Status,
		Error:    tool.Error,
		AuthMode: "cli_session",
		CanRun:   tool.Found,
	}
}

func Detect() discovery.Tool {
	return DetectWithDirs(context.Background(), nil)
}

func DetectWithDirs(ctx context.Context, toolDirs []string) discovery.Tool {
	return detect(ctx, toolDirs)
}

func detect(ctx context.Context, toolDirs []string) discovery.Tool {
	return discovery.DetectCommandWithVersionLookup(ctx, discovery.CommandLookup{
		Name:        "codex",
		Binary:      "codex",
		EnvOverride: "CODEX_BIN",
		ExtraDirs:   toolDirs,
	}, "--version")
}

func (adapter Adapter) ListModels(ctx context.Context) ([]adapters.ModelRef, error) {
	if !detect(ctx, adapter.ToolDirs).Found {
		return nil, nil
	}

	models := []string{
		"gpt-5.5",
		"gpt-5.4",
		"gpt-5.4-mini",
		"gpt-5.3-codex",
		"gpt-5.1",
		"gpt-5.1-codex-mini",
		"gpt-5-codex",
		"gpt-5",
		"o3",
		"o4-mini",
	}
	refs := make([]adapters.ModelRef, 0, len(models))
	for _, model := range models {
		refs = append(refs, modelRef(model))
	}
	return refs, nil
}

func (adapter Adapter) Run(ctx context.Context, input adapters.RunInput, emit func(adapters.RunEvent)) (*adapters.RunResult, error) {
	start := time.Now()
	if emit != nil {
		emit(adapters.RunEvent{Type: "panel.job.started", RunID: input.RunID, JobID: input.JobID, Timestamp: start.UTC().Format(time.RFC3339), Data: map[string]any{"adapter": "codex"}})
	}

	args := []string{"exec", "--sandbox", sandboxForProfile(input.PermissionProfile)}
	if input.Model != "" {
		args = append(args, "--model", input.Model)
	}
	args = append(args, input.Prompt)

	tool := detect(ctx, adapter.ToolDirs)
	if !tool.Found {
		return &adapters.RunResult{
			Status:    "failed",
			Error:     tool.Error,
			LatencyMs: time.Since(start).Milliseconds(),
		}, nil
	}

	result, err := host.Run(ctx, host.CommandSpec{
		Name:         tool.Path,
		Args:         args,
		WorkingDir:   input.WorkspacePath,
		AllowedRoots: adapter.AllowedRoots,
		Env:          input.Env,
		Timeout:      time.Duration(input.TimeoutMs) * time.Millisecond,
	})

	status := "completed"
	errText := ""
	if err != nil {
		status = "failed"
		errText = err.Error()
	}

	return &adapters.RunResult{
		Status:     status,
		OutputText: result.Stdout + result.Stderr,
		Error:      errText,
		LatencyMs:  time.Since(start).Milliseconds(),
	}, err
}

func sandboxForProfile(profile string) string {
	switch profile {
	case "trusted_internal", "workspace_write":
		return "workspace-write"
	default:
		return "read-only"
	}
}

func modelRef(model string) adapters.ModelRef {
	return adapters.ModelRef{
		ID:           "codex/" + model,
		Adapter:      "codex",
		Provider:     "openai",
		Model:        model,
		DisplayName:  model,
		AuthMode:     "cli_session",
		Availability: "configured_unverified",
		Source:       "fallback",
		Capabilities: adapters.ModelCapability{
			Streaming:    true,
			Tools:        true,
			FileEdits:    true,
			Shell:        true,
			JSONOutput:   true,
			ModelListing: false,
		},
	}
}
