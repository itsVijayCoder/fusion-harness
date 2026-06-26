package host

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/asthrix/openfusion/apps/runner-go/internal/workspace"
)

// OutputChunk is a single streamed fragment of process output. Stream is
// either "stdout" or "stderr". Text is the raw bytes (ANSI preserved) for
// one line (without the trailing newline) or a trailing partial line flushed
// when the process exits.
type OutputChunk struct {
	Stream string `json:"stream"`
	Text   string `json:"text"`
}

type CommandSpec struct {
	Name         string
	Args         []string
	Stdin        string
	WorkingDir   string
	AllowedRoots []string
	Env          map[string]string
	Timeout      time.Duration
}

type Result struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exit_code"`
}

func Available() bool {
	return true
}

func Run(ctx context.Context, spec CommandSpec) (Result, error) {
	if spec.Name == "" {
		return Result{ExitCode: -1}, errors.New("command name is required")
	}
	if err := validateWorkingDir(spec.WorkingDir, spec.AllowedRoots); err != nil {
		return Result{ExitCode: -1}, err
	}

	if spec.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, spec.Timeout)
		defer cancel()
	}

	path, err := exec.LookPath(spec.Name)
	if err != nil {
		return Result{ExitCode: -1}, err
	}

	cmd := exec.CommandContext(ctx, path, spec.Args...)
	cmd.Dir = spec.WorkingDir
	cmd.Env = processEnv(spec.Env)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	if spec.Stdin != "" {
		cmd.Stdin = strings.NewReader(spec.Stdin)
	}
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	result := Result{
		Stdout: stdout.String(),
		Stderr: stderr.String(),
	}

	if cmd.ProcessState != nil {
		result.ExitCode = cmd.ProcessState.ExitCode()
	}

	return result, err
}

// RunStreaming runs the command and streams stdout/stderr line-by-line to the
// provided callback as they arrive, while still collecting the full buffers into
// the returned Result. The callback receives OutputChunk values with the raw
// text (ANSI preserved). If onChunk is nil, this behaves like Run (no
// streaming, full buffer only). The callback is invoked from the goroutine
// reading the pipe; it must not block on the command's lifecycle.
func RunStreaming(ctx context.Context, spec CommandSpec, onChunk func(OutputChunk)) (Result, error) {
	if onChunk == nil {
		return Run(ctx, spec)
	}
	if spec.Name == "" {
		return Result{ExitCode: -1}, errors.New("command name is required")
	}
	if err := validateWorkingDir(spec.WorkingDir, spec.AllowedRoots); err != nil {
		return Result{ExitCode: -1}, err
	}

	if spec.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, spec.Timeout)
		defer cancel()
	}

	path, err := exec.LookPath(spec.Name)
	if err != nil {
		return Result{ExitCode: -1}, err
	}

	cmd := exec.CommandContext(ctx, path, spec.Args...)
	cmd.Dir = spec.WorkingDir
	cmd.Env = processEnv(spec.Env)
	if spec.Stdin != "" {
		cmd.Stdin = strings.NewReader(spec.Stdin)
	}

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return Result{ExitCode: -1}, err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return Result{ExitCode: -1}, err
	}

	if err := cmd.Start(); err != nil {
		return Result{ExitCode: -1}, err
	}

	var stdoutBuf, stderrBuf bytes.Buffer
	done := make(chan struct{}, 2)

	stream := func(pipe io.ReadCloser, buf *bytes.Buffer, name string) {
		reader := bufio.NewReader(pipe)
		for {
			line, readErr := reader.ReadString('\n')
			if line != "" {
				buf.WriteString(line)
				hasNewline := strings.HasSuffix(line, "\n")
				text := line
				if hasNewline {
					text = line[:len(line)-1]
					if strings.HasSuffix(text, "\r") {
						text = text[:len(text)-1]
					}
				}
				onChunk(OutputChunk{Stream: name, Text: text})
			}
			if readErr != nil {
				break
			}
		}
		done <- struct{}{}
	}

	go stream(stdoutPipe, &stdoutBuf, "stdout")
	go stream(stderrPipe, &stderrBuf, "stderr")

	waitErr := cmd.Wait()
	<-done
	<-done

	result := Result{
		Stdout:   stdoutBuf.String(),
		Stderr:   stderrBuf.String(),
	}
	if cmd.ProcessState != nil {
		result.ExitCode = cmd.ProcessState.ExitCode()
	}
	return result, waitErr
}

func validateWorkingDir(workingDir string, allowedRoots []string) error {
	if workingDir == "" {
		return errors.New("working directory is required")
	}
	if len(allowedRoots) == 0 {
		return errors.New("no allowed workspace roots configured")
	}

	for _, root := range allowedRoots {
		if workspace.IsWithinRoot(root, workingDir) {
			return nil
		}
	}

	return errors.New("working directory is outside the configured workspace roots")
}

func processEnv(extra map[string]string) []string {
	env := make([]string, 0, len(os.Environ())+len(extra))

	for _, item := range os.Environ() {
		env = append(env, item)
	}

	for key, value := range extra {
		env = append(env, key+"="+value)
	}

	return env
}
