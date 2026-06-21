package acp

import (
	"encoding/json"
	"testing"
)

func TestNormalizeModelsFromAvailableModels(t *testing.T) {
	result := json.RawMessage(`{
		"models": {
			"currentModelId": "gpt-5",
			"availableModels": [
				{"modelId": "gpt-5", "name": "GPT 5"},
				{"modelId": "sonnet-4", "name": "Sonnet 4"}
			]
		}
	}`)
	models := normalizeModels(result)
	if len(models) != 3 {
		t.Fatalf("expected default + 2 models, got %d: %#v", len(models), models)
	}
	if models[0].ID != "default" {
		t.Fatalf("expected default first, got %q", models[0].ID)
	}
	if models[1].ID != "gpt-5" {
		t.Fatalf("expected gpt-5, got %q", models[1].ID)
	}
	if models[1].DisplayName != "GPT 5 (gpt-5) • current" {
		t.Fatalf("expected current label, got %q", models[1].DisplayName)
	}
	if models[2].ID != "sonnet-4" {
		t.Fatalf("expected sonnet-4, got %q", models[2].ID)
	}
}

func TestNormalizeModelsFromConfigOptions(t *testing.T) {
	result := json.RawMessage(`{
		"configOptions": [
			{
				"id": "model",
				"type": "select",
				"currentValue": "opus",
				"options": [
					{"value": "sonnet", "name": "Sonnet"},
					{"value": "opus", "name": "Opus"}
				]
			}
		]
	}`)
	models := normalizeModels(result)
	if len(models) != 3 {
		t.Fatalf("expected default + 2 models, got %d: %#v", len(models), models)
	}
	if models[1].ID != "sonnet" {
		t.Fatalf("expected sonnet, got %q", models[1].ID)
	}
	if models[2].ID != "opus" {
		t.Fatalf("expected opus, got %q", models[2].ID)
	}
	if models[2].DisplayName != "Opus (opus) • current" {
		t.Fatalf("expected current label, got %q", models[2].DisplayName)
	}
}

func TestNormalizeModelsConfigOptionByCategory(t *testing.T) {
	result := json.RawMessage(`{
		"configOptions": [
			{
				"id": "selection",
				"category": "Model",
				"currentValue": "a",
				"options": [
					{"value": "a", "name": "Model A"},
					{"value": "b", "name": "Model B"}
				]
			}
		]
	}`)
	models := normalizeModels(result)
	if len(models) != 3 {
		t.Fatalf("expected default + 2 models from category match, got %d: %#v", len(models), models)
	}
}

func TestNormalizeModelsEmptyResult(t *testing.T) {
	result := json.RawMessage(`{}`)
	models := normalizeModels(result)
	if len(models) != 1 {
		t.Fatalf("expected only default, got %d: %#v", len(models), models)
	}
	if models[0].ID != "default" {
		t.Fatalf("expected default, got %q", models[0].ID)
	}
}

func TestNormalizeModelsDedupes(t *testing.T) {
	result := json.RawMessage(`{
		"models": {
			"availableModels": [
				{"modelId": "gpt-5", "name": "GPT 5"},
				{"modelId": "gpt-5", "name": "GPT 5 duplicate"}
			]
		}
	}`)
	models := normalizeModels(result)
	if len(models) != 2 {
		t.Fatalf("expected default + 1 deduped model, got %d: %#v", len(models), models)
	}
}

func TestFindModelConfigOption(t *testing.T) {
	options := []configOption{
		{ID: "theme", Category: "ui", Type: "select"},
		{ID: "selection", Category: "Model", Type: "select"},
	}
	opt := findModelConfigOption(options)
	if opt == nil {
		t.Fatal("expected to find model config option by category")
	}
	if opt.ID != "selection" {
		t.Fatalf("expected selection, got %q", opt.ID)
	}
}

func TestNormalizeToken(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"Model", "model"},
		{"model_id", "modelid"},
		{"model-id", "modelid"},
		{"Model Name", "modelname"},
		{"", ""},
	}
	for _, tt := range tests {
		got := normalizeToken(tt.input)
		if got != tt.want {
			t.Errorf("normalizeToken(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}