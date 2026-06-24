package context

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// detectStack inspects config files to determine the tech stack, package
// manager, key dependencies, and monorepo packages. No LLM call.
func detectStack(root string) (techStack []string, packageManager string, keyDeps []string, monorepo []string) {
	pkg := readPackageJSON(root)
	if pkg != nil {
		packageManager = "npm"
		techStack = append(techStack, "TypeScript", "Node.js")
		techStack = append(techStack, detectJSTech(pkg)...)
		keyDeps = topDeps(pkg)
		monorepo = detectWorkspaces(pkg)
	}

	if _, err := os.Stat(filepath.Join(root, "go.mod")); err == nil {
		techStack = append(techStack, "Go")
		if packageManager == "" {
			packageManager = "go modules"
		}
		keyDeps = append(keyDeps, readGoModDeps(root)...)
	}

	if _, err := os.Stat(filepath.Join(root, "Cargo.toml")); err == nil {
		techStack = append(techStack, "Rust")
	}
	if _, err := os.Stat(filepath.Join(root, "pyproject.toml")); err == nil {
		techStack = append(techStack, "Python")
	}

	techStack = uniqueStrings(techStack)
	sort.Strings(techStack)
	return
}

type packageJSON struct {
	Name         string            `json:"name"`
	Version      string            `json:"version"`
	Dependencies map[string]string `json:"dependencies"`
	DevDeps      map[string]string `json:"devDependencies"`
	Workspaces   json.RawMessage   `json:"workspaces"`
}

func readPackageJSON(root string) *packageJSON {
	data, err := os.ReadFile(filepath.Join(root, "package.json"))
	if err != nil {
		return nil
	}
	var pkg packageJSON
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil
	}
	return &pkg
}

func detectJSTech(pkg *packageJSON) []string {
	var stack []string
	has := func(name string) bool {
		_, ok := pkg.Dependencies[name]
		if !ok {
			_, ok = pkg.DevDeps[name]
		}
		return ok
	}
	if has("next") {
		stack = append(stack, "Next.js")
	}
	if has("react") {
		stack = append(stack, "React")
	}
	if has("tailwindcss") {
		stack = append(stack, "Tailwind CSS")
	}
	if has("@opennextjs/cloudflare") {
		stack = append(stack, "Cloudflare Workers (OpenNext)")
	}
	if has("wrangler") {
		stack = append(stack, "Cloudflare Workers")
	}
	if has("zod") {
		stack = append(stack, "Zod")
	}
	return stack
}

func topDeps(pkg *packageJSON) []string {
	type dep struct {
		name    string
		version string
	}
	var all []dep
	for n, v := range pkg.Dependencies {
		all = append(all, dep{n, v})
	}
	for n, v := range pkg.DevDeps {
		all = append(all, dep{n, v})
	}
	sort.Slice(all, func(i, j int) bool { return all[i].name < all[j].name })

	var result []string
	for _, d := range all {
		if len(result) >= 12 {
			break
		}
		result = append(result, d.name+"@"+d.version)
	}
	return result
}

func detectWorkspaces(pkg *packageJSON) []string {
	if len(pkg.Workspaces) == 0 {
		return nil
	}
	var arr []string
	if err := json.Unmarshal(pkg.Workspaces, &arr); err == nil {
		return arr
	}
	var obj struct {
		Packages []string `json:"packages"`
	}
	if err := json.Unmarshal(pkg.Workspaces, &obj); err == nil {
		return obj.Packages
	}
	return nil
}

func readGoModDeps(root string) []string {
	data, err := os.ReadFile(filepath.Join(root, "go.mod"))
	if err != nil {
		return nil
	}
	var deps []string
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "require ") {
			parts := strings.Fields(strings.TrimPrefix(line, "require "))
			if len(parts) >= 2 {
				deps = append(deps, parts[0]+"@"+parts[1])
			}
		}
	}
	return deps
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

// detectConventions infers coding conventions from config files. No LLM.
func detectConventions(root string) []string {
	var conv []string

	if tsconfigHasStrict(root) {
		conv = append(conv, "TypeScript strict mode")
	}
	if _, err := os.Stat(filepath.Join(root, ".editorconfig")); err == nil {
		conv = append(conv, "EditorConfig present")
	}
	if _, err := os.Stat(filepath.Join(root, ".eslintrc.json")); err == nil {
		conv = append(conv, "ESLint")
	}
	if _, err := os.Stat(filepath.Join(root, ".eslintrc.cjs")); err == nil {
		conv = append(conv, "ESLint")
	}
	if _, err := os.Stat(filepath.Join(root, "eslint.config.mjs")); err == nil {
		conv = append(conv, "ESLint (flat config)")
	}
	if _, err := os.Stat(filepath.Join(root, ".prettierrc")); err == nil {
		conv = append(conv, "Prettier")
	}
	if _, err := os.Stat(filepath.Join(root, "AGENT.md")); err == nil {
		conv = append(conv, "Conventional Commits")
	}
	if _, err := os.Stat(filepath.Join(root, "apps/web/components.json")); err == nil {
		conv = append(conv, "shadcn/ui")
	}
	if _, err := os.Stat(filepath.Join(root, ".golangci.yml")); err == nil {
		conv = append(conv, "golangci-lint")
	}
	return conv
}

func tsconfigHasStrict(root string) bool {
	data, err := os.ReadFile(filepath.Join(root, "tsconfig.base.json"))
	if err != nil {
		data, err = os.ReadFile(filepath.Join(root, "tsconfig.json"))
		if err != nil {
			return false
		}
	}
	return strings.Contains(string(data), `"strict"`) && strings.Contains(string(data), "true")
}
