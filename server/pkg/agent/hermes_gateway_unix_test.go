//go:build !windows

package agent

import (
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStopHermesTaskGateway(t *testing.T) {
	home, tools := t.TempDir(), t.TempDir()
	record := filepath.Join(tools, "invocation")
	path := filepath.Join(tools, "hermes")
	writeTestExecutable(t, path, []byte("#!/bin/sh\nprintf '%s\\n' \"$@\" \"$HERMES_HOME\" > \"$RECORD\"\n"))
	cfg := Config{ExecutablePath: path, LaunchPrefix: []string{"wrapped"}, Logger: slog.Default(),
		Env: map[string]string{"HERMES_HOME": home, "RECORD": record}}
	if err := StopHermesTaskGateway(cfg, home); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(record); !os.IsNotExist(err) {
		t.Fatal("in-process ACP must not invoke gateway cleanup")
	}
	if err := os.WriteFile(filepath.Join(home, "gateway.lock"), []byte("owned gateway"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := StopHermesTaskGateway(cfg, home); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(record)
	if err != nil {
		t.Fatal(err)
	}
	if want := "wrapped\n--profile\ndefault\ngateway\nstop\n" + home + "\n"; string(got) != want {
		t.Fatalf("cleanup invocation = %q, want %q", got, want)
	}
}

func TestStopHermesTaskGatewayRejectsHostState(t *testing.T) {
	home, host := t.TempDir(), t.TempDir()
	path := filepath.Join(host, "gateway.pid")
	if err := os.WriteFile(path, []byte("host gateway"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(path, filepath.Join(home, "gateway.pid")); err != nil {
		t.Fatal(err)
	}
	cfg := Config{ExecutablePath: filepath.Join(home, "must-not-run"), Env: map[string]string{"HERMES_HOME": home}}
	if err := StopHermesTaskGateway(cfg, home); err == nil || !strings.Contains(err.Error(), "non-local") {
		t.Fatalf("cleanup through host PID link = %v, want refusal", err)
	}
}
