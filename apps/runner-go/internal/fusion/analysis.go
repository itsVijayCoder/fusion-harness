package fusion

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"unicode"
)

type PanelOutputForAnalysis struct {
	Model     string
	Output    string
	Completed bool
}

type ModelStat struct {
	Model     string `json:"model"`
	OutputLen int    `json:"outputLength"`
	HasCode   bool   `json:"hasCodeBlocks"`
	HasRisks  bool   `json:"hasRisks"`
	Completed bool   `json:"completed"`
}

type UniqueInsight struct {
	Model   string `json:"model"`
	Insight string `json:"insight"`
}

type Contradiction struct {
	Topic  string   `json:"topic"`
	Models []string `json:"models"`
}

type Analysis struct {
	AgreementScore float64         `json:"agreementScore"`
	Confidence     float64         `json:"confidence"`
	UniqueInsights []UniqueInsight `json:"uniqueInsights"`
	Contradictions []Contradiction `json:"contradictions"`
	ModelStats     []ModelStat     `json:"modelStats"`
}

func computeAnalysis(outputs []PanelOutputForAnalysis) Analysis {
	var completed []PanelOutputForAnalysis
	for _, o := range outputs {
		if o.Completed && strings.TrimSpace(o.Output) != "" {
			completed = append(completed, o)
		}
	}

	if len(completed) == 0 {
		return Analysis{
			ModelStats: computeModelStats(outputs),
		}
	}

	sentenceSets := make([][]string, len(completed))
	for i, o := range completed {
		sentenceSets[i] = splitSentences(o.Output)
	}

	agreement := avgPairwiseSimilarity(sentenceSets)

	var uniqueInsights []UniqueInsight
	for i, o := range completed {
		var others []string
		for j, s := range sentenceSets {
			if j == i {
				continue
			}
			others = append(others, s...)
		}
		count := 0
		for _, s := range sentenceSets[i] {
			if len(s) <= 30 {
				continue
			}
			if !anySimilar(s, others, 0.6) {
				insight := s
				if len(insight) > 200 {
					insight = insight[:200]
				}
				uniqueInsights = append(uniqueInsights, UniqueInsight{
					Model:   o.Model,
					Insight: insight,
				})
				count++
				if count >= 3 {
					break
				}
			}
		}
	}

	contradictions := detectContradictions(completed)
	stats := computeModelStats(outputs)

	completionRate := float64(len(completed)) / float64(len(outputs))
	avgLen := 0
	for _, o := range completed {
		avgLen += len(o.Output)
	}
	avgLen /= len(completed)
	lengthFactor := float64(avgLen) / 2000.0
	if lengthFactor > 1 {
		lengthFactor = 1
	}
	confidence := agreement*0.5 + completionRate*0.3 + lengthFactor*0.2

	return Analysis{
		AgreementScore: agreement,
		Confidence:     confidence,
		UniqueInsights: uniqueInsights,
		Contradictions: contradictions,
		ModelStats:     stats,
	}
}

func computeModelStats(outputs []PanelOutputForAnalysis) []ModelStat {
	stats := make([]ModelStat, len(outputs))
	for i, o := range outputs {
		stats[i] = ModelStat{
			Model:     o.Model,
			OutputLen: len(o.Output),
			HasCode:   strings.Contains(o.Output, "```"),
			HasRisks:  containsRiskKeyword(o.Output),
			Completed: o.Completed,
		}
	}
	return stats
}

func confidenceLabel(c float64) string {
	if c >= 0.7 {
		return "high"
	}
	if c >= 0.4 {
		return "medium"
	}
	return "low"
}

func buildAnalysisHint(a Analysis, allCompleted bool) string {
	var b strings.Builder
	b.WriteString("PROGRAMMATIC PRE-ANALYSIS (computed, not authoritative):\n")
	b.WriteString(fmt.Sprintf("- Agreement score: %.2f (%s)\n", a.AgreementScore, confidenceLabel(a.AgreementScore)))
	b.WriteString(fmt.Sprintf("- Confidence: %.2f (%s)\n", a.Confidence, confidenceLabel(a.Confidence)))

	if len(a.Contradictions) > 0 {
		topics := make([]string, 0, len(a.Contradictions))
		for _, c := range a.Contradictions {
			topics = append(topics, c.Topic)
		}
		b.WriteString(fmt.Sprintf("- Likely contradictions detected: %s\n", strings.Join(topics, ", ")))
	} else {
		b.WriteString("- Likely contradictions detected: none\n")
	}

	insightCount := make(map[string]int)
	for _, ui := range a.UniqueInsights {
		insightCount[ui.Model]++
	}
	if len(insightCount) > 0 {
		parts := make([]string, 0, len(insightCount))
		for model := range insightCount {
			parts = append(parts, fmt.Sprintf("%s contributed %d unique point(s)", model, insightCount[model]))
		}
		sort.Strings(parts)
		b.WriteString(fmt.Sprintf("- Unique insights: %s\n", strings.Join(parts, ", ")))
	} else {
		b.WriteString("- Unique insights: none detected\n")
	}

	completedStr := "yes"
	if !allCompleted {
		completedStr = "no"
	}
	b.WriteString(fmt.Sprintf("- All panel models completed: %s\n", completedStr))
	b.WriteString("Use this as a hint. Verify with your own reading. Do not blindly trust these heuristics.")
	return b.String()
}

func splitSentences(text string) []string {
	var sentences []string
	var current strings.Builder

	for _, r := range text {
		if r == '.' || r == '!' || r == '?' || r == '\n' {
			current.WriteRune(r)
			s := strings.TrimSpace(current.String())
			if len(s) > 20 {
				sentences = append(sentences, s)
			}
			current.Reset()
		} else {
			current.WriteRune(r)
		}
	}
	if current.Len() > 0 {
		s := strings.TrimSpace(current.String())
		if len(s) > 20 {
			sentences = append(sentences, s)
		}
	}
	return sentences
}

func avgPairwiseSimilarity(sentenceSets [][]string) float64 {
	if len(sentenceSets) < 2 {
		return 1
	}
	total := 0.0
	count := 0
	for i := 0; i < len(sentenceSets); i++ {
		for j := i + 1; j < len(sentenceSets); j++ {
			aSet := buildNgramSet(sentenceSets[i], 3)
			bSet := buildNgramSet(sentenceSets[j], 3)
			intersection := 0
			for gram := range aSet {
				if bSet[gram] {
					intersection++
				}
			}
			union := len(aSet) + len(bSet) - intersection
			if union > 0 {
				total += float64(intersection) / float64(union)
			}
			count++
		}
	}
	if count == 0 {
		return 0
	}
	return total / float64(count)
}

func anySimilar(target string, candidates []string, threshold float64) bool {
	targetLower := strings.ToLower(target)
	targetNgrams := getNgrams(targetLower, 3)
	targetSet := make(map[string]bool, len(targetNgrams))
	for _, g := range targetNgrams {
		targetSet[g] = true
	}

	for _, c := range candidates {
		cLower := strings.ToLower(c)
		cNgrams := getNgrams(cLower, 3)
		cSet := make(map[string]bool, len(cNgrams))
		for _, g := range cNgrams {
			cSet[g] = true
		}
		intersection := 0
		for gram := range targetSet {
			if cSet[gram] {
				intersection++
			}
		}
		union := len(targetSet) + len(cSet) - intersection
		if union > 0 && float64(intersection)/float64(union) > threshold {
			return true
		}
	}
	return false
}

func buildNgramSet(sentences []string, n int) map[string]bool {
	set := make(map[string]bool)
	for _, s := range sentences {
		for _, g := range getNgrams(strings.ToLower(s), n) {
			set[g] = true
		}
	}
	return set
}

func getNgrams(text string, n int) []string {
	runes := []rune(text)
	if len(runes) < n {
		return nil
	}
	ngrams := make([]string, 0, len(runes)-n+1)
	for i := 0; i <= len(runes)-n; i++ {
		ngrams = append(ngrams, string(runes[i:i+n]))
	}
	return ngrams
}

var opposingPairs = []struct {
	positive string
	negative string
}{
	{`(?i)\b(use|recommend|prefer|should use)\b`, `(?i)\b(avoid|don't use|never use|should not use)\b`},
	{`(?i)\b(safe|secure|reliable)\b`, `(?i)\b(risky|dangerous|insecure|unreliable)\b`},
	{`(?i)\b(fast|quick|efficient)\b`, `(?i)\b(slow|inefficient|performance issue)\b`},
	{`(?i)\b(simple|easy|straightforward)\b`, `(?i)\b(complex|complicated|difficult)\b`},
	{`(?i)\b(works?|supported|compatible)\b`, `(?i)\b(fails?|broken|incompatible|unsupported)\b`},
}

func detectContradictions(outputs []PanelOutputForAnalysis) []Contradiction {
	var contradictions []Contradiction

	for _, pair := range opposingPairs {
		positiveRe := regexp.MustCompile(pair.positive)
		negativeRe := regexp.MustCompile(pair.negative)

		var positiveModels, negativeModels []string
		for _, o := range outputs {
			if positiveRe.MatchString(o.Output) {
				positiveModels = append(positiveModels, o.Model)
			}
			if negativeRe.MatchString(o.Output) {
				negativeModels = append(negativeModels, o.Model)
			}
		}

		if len(positiveModels) > 0 && len(negativeModels) > 0 {
			topic := extractTopic(pair.positive)
			allModels := uniqueStrings(append(append([]string{}, positiveModels...), negativeModels...))
			contradictions = append(contradictions, Contradiction{
				Topic:  topic,
				Models: allModels,
			})
		}
	}

	if len(contradictions) > 5 {
		contradictions = contradictions[:5]
	}
	return contradictions
}

func containsRiskKeyword(text string) bool {
	lower := strings.ToLower(text)
	keywords := []string{"risk", "warning", "caution", "danger"}
	for _, kw := range keywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

func uniqueStrings(input []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, s := range input {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}

func extractTopic(pattern string) string {
	cleaned := strings.ReplaceAll(pattern, "(?i)", "")
	cleaned = strings.ReplaceAll(cleaned, `\b`, "")
	cleaned = strings.ReplaceAll(cleaned, `(`, " ")
	cleaned = strings.ReplaceAll(cleaned, `)`, " ")
	cleaned = strings.ReplaceAll(cleaned, `|`, " ")
	fields := strings.Fields(cleaned)
	if len(fields) == 0 {
		return "Unknown"
	}
	topic := fields[0]
	if len(topic) > 0 {
		r := []rune(topic)
		r[0] = unicode.ToUpper(r[0])
		topic = string(r)
	}
	return topic
}
