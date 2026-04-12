// Package config loads and validates the gateway configuration.
//
// Config precedence (highest wins):
//  1. Environment variables with prefix AION_RG_*
//  2. TOML file at the path given via --config
//  3. Compile-time defaults below
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Env       string          `toml:"env"`
	Postgres  PostgresConfig  `toml:"postgres"`
	Redis     RedisConfig     `toml:"redis"`
	Crypto    CryptoConfig    `toml:"crypto"`
	Dahua     DahuaConfig     `toml:"dahua"`
	Hikvision HikvisionConfig `toml:"hikvision"`
	Media     MediaConfig     `toml:"media"`
	GRPC      GRPCConfig      `toml:"grpc"`
	Metrics   MetricsConfig   `toml:"metrics"`
}

type PostgresConfig struct {
	DSN string `toml:"dsn"`
}

type RedisConfig struct {
	Addr string `toml:"addr"`
	DB   int    `toml:"db"`
}

type CryptoConfig struct {
	KeyFile string `toml:"key_file"`
}

type DahuaConfig struct {
	Addr              string `toml:"addr"`                // ":7681"
	SDKLibPath        string `toml:"sdk_lib_path"`        // where libdhnetsdk.so lives
	HeartbeatTimeout  int    `toml:"heartbeat_timeout_s"` // 90
	MaxConcurrentSess int    `toml:"max_concurrent_sessions"`
}

type HikvisionConfig struct {
	SignalingAddr     string `toml:"signaling_addr"` // ":7660"
	StreamAddr        string `toml:"stream_addr"`    // ":7661"
	SDKLibPath        string `toml:"sdk_lib_path"`
	HeartbeatTimeout  int    `toml:"heartbeat_timeout_s"`
	MaxConcurrentSess int    `toml:"max_concurrent_sessions"`
}

type MediaConfig struct {
	Go2RTCURL    string `toml:"go2rtc_url"`    // http://127.0.0.1:1984
	StreamPrefix string `toml:"stream_prefix"` // "rv_"
	FFmpegPath   string `toml:"ffmpeg_path"`   // "/usr/bin/ffmpeg"
}

type GRPCConfig struct {
	Addr string `toml:"addr"` // 127.0.0.1:50551
}

type MetricsConfig struct {
	Addr string `toml:"addr"` // 127.0.0.1:9464
}

// Load reads the TOML, applies env overrides, and validates.
func Load(path string) (*Config, error) {
	cfg := defaults()

	if path != "" {
		if _, err := os.Stat(path); err == nil {
			if _, err := toml.DecodeFile(path, cfg); err != nil {
				return nil, fmt.Errorf("decode %s: %w", path, err)
			}
		} else if !os.IsNotExist(err) {
			return nil, fmt.Errorf("stat %s: %w", path, err)
		}
	}

	applyEnv(cfg)

	if err := validate(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func defaults() *Config {
	return &Config{
		Env: "production",
		Postgres: PostgresConfig{
			DSN: "postgres://aion:aion@127.0.0.1:5432/aion?sslmode=disable",
		},
		Redis: RedisConfig{
			Addr: "127.0.0.1:6379",
			DB:   3,
		},
		Crypto: CryptoConfig{
			KeyFile: "/etc/aion/reverse/kek.key",
		},
		Dahua: DahuaConfig{
			Addr:              ":7681",
			SDKLibPath:        "/opt/aion/services/reverse-gateway/sdks/dahua/lib",
			HeartbeatTimeout:  90,
			MaxConcurrentSess: 256,
		},
		Hikvision: HikvisionConfig{
			SignalingAddr:     ":7660",
			StreamAddr:        ":7661",
			SDKLibPath:        "/opt/aion/services/reverse-gateway/sdks/hikvision/lib",
			HeartbeatTimeout:  60,
			MaxConcurrentSess: 256,
		},
		Media: MediaConfig{
			Go2RTCURL:    "http://127.0.0.1:1984",
			StreamPrefix: "rv_",
			FFmpegPath:   "/usr/bin/ffmpeg",
		},
		GRPC:    GRPCConfig{Addr: "127.0.0.1:50551"},
		Metrics: MetricsConfig{Addr: "127.0.0.1:9464"},
	}
}

func applyEnv(c *Config) {
	set := func(env string, dst *string) {
		if v := os.Getenv(env); v != "" {
			*dst = v
		}
	}
	setI := func(env string, dst *int) {
		if v := os.Getenv(env); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				*dst = n
			}
		}
	}
	set("AION_RG_ENV", &c.Env)
	set("AION_RG_PG_DSN", &c.Postgres.DSN)
	set("AION_RG_REDIS_ADDR", &c.Redis.Addr)
	setI("AION_RG_REDIS_DB", &c.Redis.DB)
	set("AION_RG_KEY_FILE", &c.Crypto.KeyFile)
	set("AION_RG_DAHUA_ADDR", &c.Dahua.Addr)
	set("AION_RG_HIK_SIG_ADDR", &c.Hikvision.SignalingAddr)
	set("AION_RG_HIK_STREAM_ADDR", &c.Hikvision.StreamAddr)
	set("AION_RG_GO2RTC_URL", &c.Media.Go2RTCURL)
	set("AION_RG_GRPC_ADDR", &c.GRPC.Addr)
	set("AION_RG_METRICS_ADDR", &c.Metrics.Addr)
}

func validate(c *Config) error {
	if c.Postgres.DSN == "" {
		return errors.New("postgres.dsn required")
	}
	if !strings.HasPrefix(c.Postgres.DSN, "postgres://") && !strings.HasPrefix(c.Postgres.DSN, "postgresql://") {
		return errors.New("postgres.dsn must be a libpq URI")
	}
	if c.Crypto.KeyFile == "" {
		return errors.New("crypto.key_file required")
	}
	if c.Media.StreamPrefix == "" {
		return errors.New("media.stream_prefix required — prevents go2rtc collisions with existing AION streams")
	}
	return nil
}
