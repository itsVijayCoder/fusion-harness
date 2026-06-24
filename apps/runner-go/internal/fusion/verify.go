package fusion

import (
	"strings"
)

// VerificationResult holds the outcome of a verification pass.
type VerificationResult struct {
	// Gaps are parts of the original request the answer did not address.
	Gaps []string `json:"gaps,omitempty"`
	// UnresolvedContradictions are contradiction topics from the programmatic
	// analysis that do not appear in the final answer.
	UnresolvedContradictions []string `json:"unresolvedContradictions,omitempty"`
	// FullyCovered is true when no gaps or unresolved contradictions were found.
	FullyCovered bool `json:"fullyCovered"`
	// Refined reports whether a refinement pass was run.
	Refined bool `json:"refined,omitempty"`
}

// VerifyOptions controls when verification runs and what it checks.
type VerifyOptions struct {
	// Confidence is the programmatic analysis confidence (0-1).
	Confidence float64
	// Contradictions are the topics detected by computeAnalysis.
	Contradictions []string
	// Prompt is the original user request.
	Prompt string
	// Answer is the final answer to verify.
	Answer string
}

// shouldVerify reports whether a verification pass should run. It gates on:
//   - confidence < 0.5 (low), OR
//   - contradictions were detected, OR
//   - the task type is high-stakes (architecture/security/migration)
//
// Most runs do not need verification; it adds latency and tokens only when
// the payoff is high.
func shouldVerify(analysis *Analysis, prompt string) bool {
	if analysis == nil {
		return false
	}
	if analysis.Confidence < 0.5 {
		return true
	}
	if len(analysis.Contradictions) > 0 {
		return true
	}
	return isHighStakesTask(prompt)
}

// isHighStakesTask checks whether the prompt matches high-stakes task types
// from the planner triggers.
func isHighStakesTask(prompt string) bool {
	lower := strings.ToLower(prompt)
	triggers := []string{"architecture", "security", "migration", "threat model", "database schema", "production"}
	for _, trigger := range triggers {
		if strings.Contains(lower, trigger) {
			return true
		}
	}
	return false
}

// verifyAnswer runs a programmatic coverage check (zero tokens) against the
// final answer. It checks:
//   - Did the answer address every sentence/question in the original prompt?
//     (keyword overlap)
//   - Did the answer resolve every contradiction from the programmatic
//     analysis? (contradiction topic appears in answer)
func verifyAnswer(opts VerifyOptions) VerificationResult {
	result := VerificationResult{FullyCovered: true}

	answerLower := strings.ToLower(opts.Answer)
	promptSentences := splitSentences(opts.Prompt)

	for _, sentence := range promptSentences {
		if len(sentence) < 25 {
			continue
		}
		keywords := extractKeywords(sentence)
		if len(keywords) == 0 {
			continue
		}
		matched := 0
		for _, kw := range keywords {
			if strings.Contains(answerLower, strings.ToLower(kw)) {
				matched++
			}
		}
		// If fewer than half the keywords appear, flag as a gap.
		if matched*2 < len(keywords) {
			result.Gaps = append(result.Gaps, truncate(sentence, 120))
			result.FullyCovered = false
		}
	}

	for _, topic := range opts.Contradictions {
		if topic == "" {
			continue
		}
		if !strings.Contains(answerLower, strings.ToLower(topic)) {
			result.UnresolvedContradictions = append(result.UnresolvedContradictions, topic)
			result.FullyCovered = false
		}
	}

	return result
}

// buildRefinementPrompt appends a gap list to the original judge prompt for a
// single refinement pass.
func buildRefinementPrompt(basePrompt string, gaps []string, unresolved []string) string {
	if len(gaps) == 0 && len(unresolved) == 0 {
		return basePrompt
	}
	var b strings.Builder
	b.WriteString(basePrompt)
	b.WriteString("\n\n---\n\n")
	b.WriteString("Your previous answer did not fully address the request. Revise to cover these:\n")
	for _, gap := range gaps {
		b.WriteString("- Gap: ")
		b.WriteString(gap)
		b.WriteString("\n")
	}
	for _, topic := range unresolved {
		b.WriteString("- Unresolved contradiction: ")
		b.WriteString(topic)
		b.WriteString("\n")
	}
	b.WriteString("\nAddress every item above explicitly in your revised answer.")
	return b.String()
}

func extractKeywords(sentence string) []string {
	stop := map[string]bool{
		"the": true, "a": true, "an": true, "is": true, "are": true, "was": true,
		"were": true, "be": true, "been": true, "being": true, "have": true,
		"has": true, "had": true, "do": true, "does": true, "did": true,
		"will": true, "would": true, "could": true, "should": true, "may": true,
		"might": true, "must": true, "shall": true, "can": true, "to": true,
		"of": true, "in": true, "on": true, "at": true, "by": true, "for": true,
		"with": true, "about": true, "as": true, "into": true, "like": true,
		"through": true, "after": true, "over": true, "between": true, "out": true,
		"against": true, "during": true, "without": true, "before": true, "under": true,
		"around": true, "among": true, "and": true, "but": true, "or": true, "not": true,
		"no": true, "nor": true, "so": true, "yet": true, "this": true, "that": true,
		"these": true, "those": true, "i": true, "you": true, "he": true, "she": true,
		"it": true, "we": true, "they": true, "what": true, "which": true, "who": true,
		"when": true, "where": true, "why": true, "how": true, "all": true, "each": true,
		"every": true, "both": true, "few": true, "more": true, "most": true, "other": true,
		"some": true, "such": true, "only": true, "own": true, "same": true, "than": true,
		"too": true, "very": true, "just": true, "also": true, "if": true, "then": true,
		"there": true, "here": true, "from": true, "up": true, "down": true, "off": true,
		"above": true, "any": true, "my": true, "your": true, "its": true, "our": true,
	}
	words := strings.Fields(strings.ToLower(sentence))
	var keywords []string
	for _, w := range words {
		w = strings.Trim(w, ".,!?;:\"'()[]{}")
		if len(w) < 3 || stop[w] {
			continue
		}
		keywords = append(keywords, w)
	}
	return keywords
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
