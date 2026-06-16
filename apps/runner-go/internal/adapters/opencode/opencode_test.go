package opencode

import "testing"

func TestParseModelLinesTagsLiveModels(t *testing.T) {
	models := parseModelLines("openai/gpt-5\n- anthropic/claude-sonnet-4-5\n")
	if len(models) != 2 {
		t.Fatalf("expected 2 models, got %d", len(models))
	}
	for _, model := range models {
		if model.Availability != "listed" {
			t.Fatalf("expected listed availability, got %q", model.Availability)
		}
		if model.Source != "live" {
			t.Fatalf("expected live source, got %q", model.Source)
		}
	}
}

func TestDefaultModelsIncludeProviderSuggestions(t *testing.T) {
	models := defaultModels()
	ids := map[string]bool{}
	sources := map[string]string{}
	for _, model := range models {
		ids[model.ID] = true
		sources[model.ID] = model.Source
	}

	expected := []string{
		"opencode/anthropic/claude-sonnet-4-5",
		"opencode/openai/gpt-5",
		"opencode/google/gemini-2.5-pro",
		"opencode/minimax/minimax-m1",
		"opencode/deepseek/deepseek-chat",
		"opencode/moonshotai/kimi-k2",
	}
	for _, id := range expected {
		if !ids[id] {
			t.Fatalf("expected default model %s", id)
		}
	}
	if sources["opencode/minimax/minimax-m1"] != "suggested" {
		t.Fatalf("expected minimax fallback to be suggested, got %q", sources["opencode/minimax/minimax-m1"])
	}
}
