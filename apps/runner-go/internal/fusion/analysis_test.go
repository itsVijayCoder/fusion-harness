package fusion

import (
	"strings"
	"testing"
)

func TestComputeAnalysisEmpty(t *testing.T) {
	a := computeAnalysis(nil)
	if a.AgreementScore != 0 || a.Confidence != 0 {
		t.Fatalf("expected zero analysis for empty input, got %+v", a)
	}
	if len(a.ModelStats) != 0 {
		t.Fatalf("expected no model stats for empty input, got %d", len(a.ModelStats))
	}
}

func TestComputeAnalysisSingleCompleted(t *testing.T) {
	outputs := []PanelOutputForAnalysis{
		{Model: "m1", Output: "This is a complete sentence with enough length to be counted.", Completed: true},
	}
	a := computeAnalysis(outputs)
	if a.AgreementScore != 1 {
		t.Fatalf("expected agreement 1 for single output, got %f", a.AgreementScore)
	}
	if a.Confidence <= 0 {
		t.Fatalf("expected positive confidence for single completed output, got %f", a.Confidence)
	}
}

func TestComputeAnalysisIdenticalOutputsHighAgreement(t *testing.T) {
	text := "Use the recommended approach. It is safe and reliable. This works well in production."
	outputs := []PanelOutputForAnalysis{
		{Model: "m1", Output: text, Completed: true},
		{Model: "m2", Output: text, Completed: true},
	}
	a := computeAnalysis(outputs)
	if a.AgreementScore < 0.9 {
		t.Fatalf("expected high agreement for identical outputs, got %f", a.AgreementScore)
	}
	if a.Confidence < 0.7 {
		t.Fatalf("expected high confidence for identical completed outputs, got %f", a.Confidence)
	}
}

func TestComputeAnalysisDetectsContradictions(t *testing.T) {
	outputs := []PanelOutputForAnalysis{
		{Model: "m1", Output: "You should use the recommended library. It is safe and reliable.", Completed: true},
		{Model: "m2", Output: "Avoid that library. It is risky and dangerous in production.", Completed: true},
	}
	a := computeAnalysis(outputs)
	if len(a.Contradictions) == 0 {
		t.Fatalf("expected contradictions to be detected, got none")
	}
}

func TestComputeAnalysisUniqueInsights(t *testing.T) {
	outputs := []PanelOutputForAnalysis{
		{Model: "m1", Output: "Use the standard approach. It is well tested and documented thoroughly here.", Completed: true},
		{Model: "m2", Output: "Use the standard approach. It is well tested and documented thoroughly here.", Completed: true},
	}
	a := computeAnalysis(outputs)
	if len(a.UniqueInsights) != 0 {
		t.Fatalf("expected no unique insights for identical outputs, got %d", len(a.UniqueInsights))
	}
}

func TestConfidenceLabel(t *testing.T) {
	cases := []struct {
		value    float64
		expected string
	}{
		{0.8, "high"},
		{0.7, "high"},
		{0.5, "medium"},
		{0.4, "medium"},
		{0.2, "low"},
	}
	for _, c := range cases {
		if got := confidenceLabel(c.value); got != c.expected {
			t.Fatalf("confidenceLabel(%f) = %s, want %s", c.value, got, c.expected)
		}
	}
}

func TestBuildAnalysisHintContainsKeyFields(t *testing.T) {
	a := Analysis{
		AgreementScore: 0.72,
		Confidence:     0.68,
		Contradictions: []Contradiction{{Topic: "Use", Models: []string{"m1", "m2"}}},
		UniqueInsights: []UniqueInsight{{Model: "m1", Insight: "some insight"}},
	}
	hint := buildAnalysisHint(a, true)
	if !strings.Contains(hint, "Agreement score: 0.72") {
		t.Fatalf("hint missing agreement score: %s", hint)
	}
	if !strings.Contains(hint, "Confidence: 0.68") {
		t.Fatalf("hint missing confidence: %s", hint)
	}
	if !strings.Contains(hint, "Use") {
		t.Fatalf("hint missing contradiction topic: %s", hint)
	}
	if !strings.Contains(hint, "m1 contributed 1 unique point(s)") {
		t.Fatalf("hint missing unique insight: %s", hint)
	}
	if !strings.Contains(hint, "All panel models completed: yes") {
		t.Fatalf("hint missing completion status: %s", hint)
	}
	if !strings.Contains(hint, "Use this as a hint") {
		t.Fatalf("hint missing guidance footer: %s", hint)
	}
}

func TestBuildAnalysisHintNoContradictions(t *testing.T) {
	a := Analysis{
		AgreementScore: 0.9,
		Confidence:     0.85,
	}
	hint := buildAnalysisHint(a, false)
	if !strings.Contains(hint, "Likely contradictions detected: none") {
		t.Fatalf("hint should say none for contradictions: %s", hint)
	}
	if !strings.Contains(hint, "All panel models completed: no") {
		t.Fatalf("hint should say no for completion: %s", hint)
	}
}

func TestSplitSentences(t *testing.T) {
	text := "First sentence here with enough length. Second one also has enough length! And a third with length too? Plus newline.\nDone with enough length."
	sentences := splitSentences(text)
	if len(sentences) == 0 {
		t.Fatalf("expected sentences to be split, got none")
	}
}

func TestGetNgramsShortText(t *testing.T) {
	ngrams := getNgrams("ab", 3)
	if ngrams != nil {
		t.Fatalf("expected nil ngrams for text shorter than n, got %v", ngrams)
	}
	ngrams = getNgrams("abc", 3)
	if len(ngrams) != 1 || ngrams[0] != "abc" {
		t.Fatalf("expected single ngram 'abc', got %v", ngrams)
	}
}
