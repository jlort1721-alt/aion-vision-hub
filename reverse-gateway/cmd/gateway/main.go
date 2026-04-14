// Package main is the entrypoint for the AION reverse-connect gateway.
//
// Responsibilities:
//   - Load configuration
//   - Initialize structured logging
//   - Open Postgres + Redis connections
//   - Start Dahua listener (:7681)
//   - Start Hikvision ISUP listener (:7660 + :7661)
//   - Start gRPC server for Fastify to call into
//   - Start Prometheus /metrics server
//   - Handle SIGTERM/SIGINT with graceful shutdown (drain sessions, flush state)
//
// Every subsystem accepts a context.Context; cancellation propagates cleanly.
package main

import (
	"context"
	"errors"
	"flag"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"

	"github.com/claveseg/aion/reverse-gateway/internal/api"
	"github.com/claveseg/aion/reverse-gateway/internal/config"
	"github.com/claveseg/aion/reverse-gateway/internal/crypto"
	"github.com/claveseg/aion/reverse-gateway/internal/dahua"
	"github.com/claveseg/aion/reverse-gateway/internal/hikvision"
	"github.com/claveseg/aion/reverse-gateway/internal/media"
	"github.com/claveseg/aion/reverse-gateway/internal/metrics"
	"github.com/claveseg/aion/reverse-gateway/internal/session"
	"github.com/claveseg/aion/reverse-gateway/internal/store"
)

var (
	cfgPath = flag.String("config", "/etc/aion/reverse/gateway.toml", "path to gateway config")
	version = "v1.1.0-reverse-connect" // overridden at build time via -ldflags
)

func main() {
	flag.Parse()

	// Root logger: JSON on stdout, PM2 captures it.
	zerolog.TimeFieldFormat = time.RFC3339Nano
	log.Logger = zerolog.New(os.Stdout).With().Timestamp().Str("svc", "reverse-gateway").Str("ver", version).Logger()

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer cancel()

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		log.Fatal().Err(err).Str("path", *cfgPath).Msg("config load failed")
	}
	log.Info().Str("env", cfg.Env).Msg("config loaded")

	// ------------------------------------------------------------------ crypto
	kek, err := crypto.LoadKEK(cfg.Crypto.KeyFile)
	if err != nil {
		log.Fatal().Err(err).Msg("KEK load failed — gateway cannot run without encryption key")
	}

	// ------------------------------------------------------------------ storage
	pg, err := store.OpenPostgres(ctx, cfg.Postgres.DSN)
	if err != nil {
		log.Fatal().Err(err).Msg("postgres connect failed")
	}
	defer pg.Close()

	rdb, err := store.OpenRedis(ctx, cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
	if err != nil {
		log.Fatal().Err(err).Msg("redis connect failed")
	}
	defer rdb.Close()

	// ------------------------------------------------------------------ session mgr
	sm := session.NewManager(pg, rdb, kek, metrics.Default)

	// ------------------------------------------------------------------ media bridge
	mb := media.NewGo2RTCBridge(cfg.Media.Go2RTCURL, cfg.Media.StreamPrefix)
	if err := mb.Ping(ctx); err != nil {
		log.Fatal().Err(err).Msg("go2rtc unreachable — gateway refuses to start blind")
	}

	// ------------------------------------------------------------------ vendor listeners
	dahuaLn, err := dahua.NewListener(cfg.Dahua, sm, mb)
	if err != nil {
		log.Fatal().Err(err).Msg("dahua listener init failed")
	}

	hikLn, err := hikvision.NewListener(cfg.Hikvision, sm, mb)
	if err != nil {
		log.Fatal().Err(err).Msg("hikvision listener init failed")
	}

	// ------------------------------------------------------------------ gRPC API
	grpcLis, err := net.Listen("tcp", cfg.GRPC.Addr)
	if err != nil {
		log.Fatal().Err(err).Str("addr", cfg.GRPC.Addr).Msg("grpc listen failed")
	}
	grpcSrv := grpc.NewServer(
		grpc.UnaryInterceptor(api.LoggingInterceptor),
	)
	api.Register(grpcSrv, sm, mb, dahuaLn, hikLn)

	// ------------------------------------------------------------------ metrics http
	metricsMux := http.NewServeMux()
	metricsMux.Handle("/metrics", promhttp.Handler())
	metricsMux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		if err := pg.Ping(context.Background()); err != nil {
			http.Error(w, "postgres down", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true,"version":"` + version + `"}`))
	})
	metricsSrv := &http.Server{
		Addr:              cfg.Metrics.Addr,
		Handler:           metricsMux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// ------------------------------------------------------------------ run everything
	var wg sync.WaitGroup
	wg.Add(4)

	go func() {
		defer wg.Done()
		log.Info().Str("addr", cfg.Dahua.Addr).Msg("dahua listener starting")
		if err := dahuaLn.Serve(ctx); err != nil && !errors.Is(err, context.Canceled) {
			log.Error().Err(err).Msg("dahua listener died")
			cancel()
		}
	}()

	go func() {
		defer wg.Done()
		log.Info().Str("signaling", cfg.Hikvision.SignalingAddr).Str("stream", cfg.Hikvision.StreamAddr).Msg("hikvision listener starting")
		if err := hikLn.Serve(ctx); err != nil && !errors.Is(err, context.Canceled) {
			log.Error().Err(err).Msg("hikvision listener died")
			cancel()
		}
	}()

	go func() {
		defer wg.Done()
		log.Info().Str("addr", cfg.GRPC.Addr).Msg("grpc api starting")
		if err := grpcSrv.Serve(grpcLis); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
			log.Error().Err(err).Msg("grpc server died")
			cancel()
		}
	}()

	go func() {
		defer wg.Done()
		log.Info().Str("addr", cfg.Metrics.Addr).Msg("metrics server starting")
		if err := metricsSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error().Err(err).Msg("metrics server died")
			cancel()
		}
	}()

	<-ctx.Done()
	log.Warn().Msg("shutdown signal received, draining")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	// order matters: stop accepting new, then drain, then close stores
	grpcSrv.GracefulStop()
	_ = metricsSrv.Shutdown(shutdownCtx)
	dahuaLn.Stop()
	hikLn.Stop()
	sm.DrainAll(shutdownCtx) // close sessions, remove streams from go2rtc

	wg.Wait()
	log.Info().Msg("gateway exited cleanly")
}
