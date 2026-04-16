// reverse-gateway/test/unit/config_test.go
package unit

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/claveseg/aion/reverse-gateway/internal/config"
)

const validTOML = `
env = "test"

[postgres]
dsn = "postgres://u:p@localhost:5432/db"

[redis]
addr = "127.0.0.1:6379"
db   = 3

[crypto]
key_file = "/tmp/kek"

[media]
go2rtc_url    = "http://127.0.0.1:1984"
stream_prefix = "rv_"
ffmpeg_path   = "/usr/bin/ffmpeg"
`

func writeTOML(t *testing.T, body string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "gw.toml")
	if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := config.Load(writeTOML(t, validTOML))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Env != "test" {
		t.Errorf("env = %q", cfg.Env)
	}
	if cfg.Dahua.Addr != ":7681" {
		t.Errorf("default dahua addr lost")
	}
	if cfg.Hikvision.SignalingAddr != ":7660" {
		t.Errorf("default hik sig addr lost")
	}
}

func TestLoadEnvOverride(t *testing.T) {
	t.Setenv("AION_RG_REDIS_DB", "7")
	t.Setenv("AION_RG_DAHUA_ADDR", ":9999")
	cfg, err := config.Load(writeTOML(t, validTOML))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Redis.DB != 7 {
		t.Errorf("env override failed: db=%d", cfg.Redis.DB)
	}
	if cfg.Dahua.Addr != ":9999" {
		t.Errorf("env override failed: dahua.addr=%q", cfg.Dahua.Addr)
	}
}

func TestLoadRejectsBadDSN(t *testing.T) {
	bad := `
env = "test"
[postgres]
dsn = "mysql://..."
[crypto]
key_file = "/tmp/k"
[media]
stream_prefix = "rv_"
`
	if _, err := config.Load(writeTOML(t, bad)); err == nil {
		t.Fatal("expected error on non-postgres DSN")
	}
}

func TestLoadRejectsEmptyPrefix(t *testing.T) {
	bad := `
env = "test"
[postgres]
dsn = "postgres://a@b/c"
[crypto]
key_file = "/tmp/k"
[media]
stream_prefix = ""
`
	if _, err := config.Load(writeTOML(t, bad)); err == nil {
		t.Fatal("expected error: empty stream prefix would collide with existing go2rtc streams")
	}
}
