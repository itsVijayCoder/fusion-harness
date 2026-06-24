package fusion

import (
	"strings"
	"testing"
)

func TestShouldVerifyLowConfidence(t *testing.T) {
	a := &Analysis{Confidence: 0.3}
	if !shouldVerify(a, "simple question") {
		t.Fatal("expected verify when confidence is low")
	}
}

func TestShouldVerifyContradictions(t *testing.T) {
	a := &Analysis{
		Confidence:     0.8,
		Contradictions: []Contradiction{{Topic: "Use", Models: []string{"m1", "m2"}}},
	}
	if !shouldVerify(a, "simple question") {
		t.Fatal("expected verify when contradictions exist")
	}
}

func TestShouldVerifyHighStakesTask(t *testing.T) {
	a := &Analysis{Confidence: 0.9}
	if !shouldVerify(a, "review the security of this architecture") {
		t.Fatal("expected verify for high-stakes task")
	}
}

func TestShouldVerifySkipsHighConfidenceSimple(t *testing.T) {
	a := &Analysis{Confidence: 0.8}
	if shouldVerify(a, "what is 2+2") {
		t.Fatal("expected no verify for high-confidence simple task")
	}
}

func TestShouldVerifyNilAnalysis(t *testing.T) {
	if shouldVerify(nil, "anything") {
		t.Fatal("expected no verify when analysis is nil")
	}
}

func TestVerifyAnswerFullyCovered(t *testing.T) {
	prompt := "How should I implement the authentication module for this service?"
	answer := "To implement the authentication module for this service, use JWT tokens with a refresh token rotation strategy."
	vr := verifyAnswer(VerifyOptions{Prompt: prompt, Answer: answer})
	if !vr.FullyCovered {
		t.Fatalf("expected fully covered, got gaps: %v", vr.Gaps)
	}
}

func TestVerifyAnswerDetectsGaps(t *testing.T) {
	prompt := "How should I implement the authentication module and also handle the database migration?"
	answer := "Use JWT tokens for authentication."
	vr := verifyAnswer(VerifyOptions{Prompt: prompt, Answer: answer})
	if vr.FullyCovered {
		t.Fatal("expected gaps to be detected")
	}
	if len(vr.Gaps) == 0 {
		t.Fatal("expected at least one gap")
	}
}

func TestVerifyAnswerDetectsUnresolvedContradictions(t *testing.T) {
	prompt := "Should I use Redis or Memcached?"
	answer := "You should consider your use case carefully."
	vr := verifyAnswer(VerifyOptions{
		Prompt:         prompt,
		Answer:         answer,
		Contradictions: []string{"Redis"},
	})
	if vr.FullyCovered {
		t.Fatal("expected unresolved contradiction")
	}
	if len(vr.UnresolvedContradictions) == 0 {
		t.Fatal("expected at least one unresolved contradiction")
	}
}

func TestVerifyAnswerResolvesContradictionByMention(t *testing.T) {
	prompt := "Should I use Redis or Memcached?"
	answer := "Use Redis for persistence. Redis is the better choice here."
	vr := verifyAnswer(VerifyOptions{
		Prompt:         prompt,
		Answer:         answer,
		Contradictions: []string{"Redis"},
	})
	if len(vr.UnresolvedContradictions) != 0 {
		t.Fatalf("expected contradiction resolved by mention, got %v", vr.UnresolvedContradictions)
	}
}

func TestBuildRefinementPromptIncludesGaps(t *testing.T) {
	prompt := buildRefinementPrompt("base prompt", []string{"gap one", "gap two"}, []string{"Use"})
	if !strings.Contains(prompt, "gap one") {
		t.Fatalf("refinement prompt missing gap one")
	}
	if !strings.Contains(prompt, "gap two") {
		t.Fatalf("refinement prompt missing gap two")
	}
	if !strings.Contains(prompt, "Unresolved contradiction: Use") {
		t.Fatalf("refinement prompt missing unresolved contradiction")
	}
	if !strings.Contains(prompt, "Address every item above") {
		t.Fatalf("refinement prompt missing instruction")
	}
}

func TestBuildRefinementPromptNoGaps(t *testing.T) {
	result := buildRefinementPrompt("base prompt", nil, nil)
	if result != "base prompt" {
		t.Fatalf("expected unchanged prompt when no gaps, got %s", result)
	}
}

func TestIsHighStakesTask(t *testing.T) {
	cases := []struct {
		prompt   string
		expected bool
	}{
		{"review the architecture of this system", true},
		{"check for security vulnerabilities", true},
		{"plan the database migration", true},
		{"what is 2+2", false},
		{"fix the typo", false},
	}
	for _, c := range cases {
		if got := isHighStakesTask(c.prompt); got != c.expected {
			t.Fatalf("isHighStakesTask(%q) = %v, want %v", c.prompt, got, c.expected)
		}
	}
}

func TestExtractKeywordsFiltersStopwords(t *testing.T) {
	kw := extractKeywords("the quick brown fox jumps over the lazy dog")
	for _, w := range kw {
		if w == "the" || w == "over" {
			t.Fatalf("stopword not filtered: %s", w)
		}
	}
	if len(kw) == 0 {
		t.Fatal("expected keywords after filtering")
	}
}
