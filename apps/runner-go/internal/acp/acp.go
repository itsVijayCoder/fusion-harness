package acp

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

const (
	ProtocolVersion  = 1
	DefaultTimeout   = 15 * time.Second
	ClientName       = "fusion-harness-detect"
	ClientVersion    = "runtime-adapter"
	DefaultModelID   = "default"
	DefaultModelName = "Default (CLI config)"
)

type ModelOption struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
}

type DetectOptions struct {
	Bin          string
	Args         []string
	Cwd          string
	Env          []string
	Timeout      time.Duration
	ClientName   string
	ClientVersion string
}

func DetectModels(ctx context.Context, opts DetectOptions) ([]ModelOption, error) {
	if opts.Bin == "" {
		return nil, errors.New("acp: bin is required")
	}
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	clientName := opts.ClientName
	if clientName == "" {
		clientName = ClientName
	}
	clientVersion := opts.ClientVersion
	if clientVersion == "" {
		clientVersion = ClientVersion
	}
	cwd := opts.Cwd
	if cwd == "" {
		cwd, _ = os.Getwd()
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, opts.Bin, opts.Args...)
	cmd.Dir = cwd
	if len(opts.Env) > 0 {
		cmd.Env = opts.Env
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("acp: stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("acp: stdout pipe: %w", err)
	}
	var stderrBuf strings.Builder
	cmd.Stderr = &stderrBuf

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("acp: start %s: %w", opts.Bin, err)
	}

	resultCh := make(chan struct {
		models []ModelOption
		err    error
	}, 1)

	go func() {
		defer stdin.Close()
		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

		writeReq := func(id int, method string, params any) error {
			payload := map[string]any{
				"jsonrpc": "2.0",
				"id":      id,
				"method":  method,
			}
			if params != nil {
				payload["params"] = params
			}
			data, err := json.Marshal(payload)
			if err != nil {
				return err
			}
			data = append(data, '\n')
			_, err = stdin.Write(data)
			return err
		}

		initializeParams := map[string]any{
			"protocolVersion":   ProtocolVersion,
			"clientCapabilities": map[string]any{"terminal": false},
			"clientInfo":        map[string]any{"name": clientName, "version": clientVersion},
		}
		if err := writeReq(1, "initialize", initializeParams); err != nil {
			resultCh <- struct {
				models []ModelOption
				err    error
			}{nil, fmt.Errorf("acp: write initialize: %w", err)}
			return
		}

		sessionNewParams := map[string]any{
			"cwd":       cwd,
			"mcpServers": []any{},
		}
		phase := 1
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || !strings.HasPrefix(line, "{") {
				continue
			}
			var resp rpcResponse
			if err := json.Unmarshal([]byte(line), &resp); err != nil {
				continue
			}
			if resp.Error != nil {
				resultCh <- struct {
					models []ModelOption
					err    error
				}{nil, fmt.Errorf("acp: json-rpc error %d: %s", resp.Error.Code, resp.Error.Message)}
				return
			}
			if resp.ID != phase {
				continue
			}
			if phase == 1 {
				if err := writeReq(2, "session/new", sessionNewParams); err != nil {
					resultCh <- struct {
						models []ModelOption
						err    error
					}{nil, fmt.Errorf("acp: write session/new: %w", err)}
					return
				}
				phase = 2
				continue
			}
			if phase == 2 {
				models := normalizeModels(resp.Result)
				resultCh <- struct {
					models []ModelOption
					err    error
				}{models, nil}
				return
			}
		}
		if err := scanner.Err(); err != nil {
			resultCh <- struct {
				models []ModelOption
				err    error
			}{nil, fmt.Errorf("acp: read stdout: %w", err)}
			return
		}
		resultCh <- struct {
			models []ModelOption
			err    error
		}{nil, fmt.Errorf("acp: process closed stdout before session/new response")}
	}()

	select {
	case res := <-resultCh:
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return res.models, res.err
	case <-ctx.Done():
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		tail := strings.TrimSpace(stderrBuf.String())
		if len(tail) > 500 {
			tail = tail[len(tail)-500:]
		}
		if tail != "" {
			return nil, fmt.Errorf("acp: timed out after %s: stderr=%s", timeout, tail)
		}
		return nil, fmt.Errorf("acp: timed out after %s", timeout)
	}
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type sessionModels struct {
	CurrentModelID   string          `json:"currentModelId"`
	AvailableModels  []availableModel `json:"availableModels"`
}

type availableModel struct {
	ModelID string `json:"modelId"`
	Name    string `json:"name"`
}

type configOption struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Category     string         `json:"category"`
	Type         string         `json:"type"`
	CurrentValue string         `json:"currentValue"`
	Options      []configOptionValue `json:"options"`
}

type configOptionValue struct {
	Value string `json:"value"`
	Name  string `json:"name"`
}

func normalizeModels(result json.RawMessage) []ModelOption {
	out := []ModelOption{{ID: DefaultModelID, DisplayName: DefaultModelName}}
	seen := map[string]bool{DefaultModelID: true}

	var sessionNew struct {
		Models        json.RawMessage `json:"models"`
		ConfigOptions json.RawMessage `json:"configOptions"`
	}
	_ = json.Unmarshal(result, &sessionNew)

	if len(sessionNew.ConfigOptions) > 0 {
		var options []configOption
		if err := json.Unmarshal(sessionNew.ConfigOptions, &options); err == nil {
			if mc := findModelConfigOption(options); mc != nil {
				for _, v := range mc.Options {
					id := strings.TrimSpace(v.Value)
					if id == "" {
						id = strings.TrimSpace(v.Name)
					}
					if id == "" || seen[id] {
						continue
					}
					seen[id] = true
					label := strings.TrimSpace(v.Name)
					if label == "" || label == id {
						label = id
					} else {
						label = fmt.Sprintf("%s (%s)", label, id)
					}
					if id == mc.CurrentValue {
						label += " • current"
					}
					out = append(out, ModelOption{ID: id, DisplayName: label})
				}
				if len(out) > 1 {
					return out
				}
			}
		}
	}

	if len(sessionNew.Models) > 0 {
		var sm sessionModels
		if err := json.Unmarshal(sessionNew.Models, &sm); err == nil {
			for _, m := range sm.AvailableModels {
				id := strings.TrimSpace(m.ModelID)
				if id == "" || seen[id] {
					continue
				}
				seen[id] = true
				label := strings.TrimSpace(m.Name)
				if label == "" || label == id {
					label = id
				} else {
					label = fmt.Sprintf("%s (%s)", label, id)
				}
				if id == sm.CurrentModelID {
					label += " • current"
				}
				out = append(out, ModelOption{ID: id, DisplayName: label})
			}
		}
	}

	return out
}

func findModelConfigOption(options []configOption) *configOption {
	for i := range options {
		opt := &options[i]
		if normalizeToken(opt.Category) == "model" {
			return opt
		}
		if normalizeToken(opt.ID) == "model" {
			return opt
		}
		if normalizeToken(opt.Name) == "model" {
			return opt
		}
	}
	return nil
}

func normalizeToken(s string) string {
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "_", "")
	s = strings.ReplaceAll(s, "-", "")
	return strings.ToLower(s)
}

func NeutralWorkspace(agentID string, allowedRoots []string) (string, []string, func()) {
	dir, err := os.MkdirTemp("", "fusion-"+agentID+"-acp-*")
	if err == nil {
		return dir, appendIfMissing(allowedRoots, dir), func() { _ = os.RemoveAll(dir) }
	}
	for _, root := range allowedRoots {
		if info, statErr := os.Stat(root); statErr == nil && info.IsDir() {
			return root, allowedRoots, func() {}
		}
	}
	cwd, cwdErr := os.Getwd()
	if cwdErr == nil {
		return cwd, appendIfMissing(allowedRoots, cwd), func() {}
	}
	return ".", appendIfMissing(allowedRoots, "."), func() {}
}

func appendIfMissing(items []string, item string) []string {
	for _, existing := range items {
		if existing == item {
			return items
		}
	}
	return append(append([]string{}, items...), item)
}