// Package api exposes a minimal gRPC surface that Fastify calls into.
//
// Surface (one service, rpc names kept short):
//   ListSessions()                   → array of { session_id, device_id, vendor, addr, online_since }
//   StartStream(session_id, channel) → { rtsp_url, go2rtc_name, codec }
//   StopStream(session_id, channel)
//   PTZ(session_id, channel, action, speed, preset)
//   Snapshot(session_id, channel)    → { jpeg_bytes }
//   ApproveDevice(vendor, device_id, creds...) — note: HTTP admin path usually
//     preferred; provided here too so the API server can do everything via gRPC.
//
// In the real module we'd define a .proto and codegen. For a single
// autocontained file we implement the service directly on top of raw grpc
// with JSON-over-gRPC style handlers (using codec=json). A production
// deployment must replace this with a proper protobuf definition.
package api

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"

	"github.com/claveseg/aion/reverse-gateway/internal/dahua"
	"github.com/claveseg/aion/reverse-gateway/internal/hikvision"
	"github.com/claveseg/aion/reverse-gateway/internal/media"
	"github.com/claveseg/aion/reverse-gateway/internal/session"
)

// Service bundles dependencies needed by RPC handlers.
type Service struct {
	sm  *session.Manager
	mb  *media.Go2RTCBridge
	dl  *dahua.Listener
	hl  *hikvision.Listener
}

// Register wires our service onto the gRPC server. In a real build this would
// be `pb.RegisterReverseGatewayServer(s, &Service{...})`. We document the
// expectation here so the Fastify client (written in TS) knows the contract.
func Register(s *grpc.Server, sm *session.Manager, mb *media.Go2RTCBridge,
	dl *dahua.Listener, hl *hikvision.Listener) {
	// The real .proto file lives in proto/reverse_gateway.proto; after
	// codegen, replace this with pb.RegisterReverseGatewayServer.
	_ = &Service{sm: sm, mb: mb, dl: dl, hl: hl}
}

// LoggingInterceptor is a unary server interceptor that logs timing and errors.
func LoggingInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	start := time.Now()
	resp, err := handler(ctx, req)
	ev := log.Info()
	if err != nil {
		ev = log.Error().Err(err)
	}
	ev.Str("method", info.FullMethod).Dur("took", time.Since(start)).Msg("grpc")
	return resp, err
}

// ------ Handler implementations (illustrative signatures) ------

type ListSessionsResp struct {
	Sessions []SessionDTO `json:"sessions"`
}

type SessionDTO struct {
	SessionID  uuid.UUID `json:"session_id"`
	DeviceID   string    `json:"device_id"`
	Vendor     string    `json:"vendor"`
	RemoteAddr string    `json:"remote_addr"`
	OpenedAt   time.Time `json:"opened_at"`
	LastBeat   time.Time `json:"last_heartbeat"`
}

func (s *Service) ListSessions(ctx context.Context, _ *struct{}) (*ListSessionsResp, error) {
	out := &ListSessionsResp{}
	for _, h := range s.sm.List() {
		out.Sessions = append(out.Sessions, SessionDTO{
			SessionID:  h.SessionID,
			DeviceID:   h.DeviceID,
			Vendor:     string(h.Vendor),
			RemoteAddr: h.RemoteAddr.String(),
			OpenedAt:   h.OpenedAt,
			LastBeat:   h.LastHeartbeat,
		})
	}
	return out, nil
}

type StartStreamReq struct {
	SessionID uuid.UUID `json:"session_id"`
	Channel   int       `json:"channel"`
}

type StartStreamResp struct {
	RtspURL    string `json:"rtsp_url"`
	Go2RTCName string `json:"go2rtc_name"`
	Codec      string `json:"codec"`
}

func (s *Service) StartStream(ctx context.Context, req *StartStreamReq) (*StartStreamResp, error) {
	h, ok := s.sm.Get(req.SessionID)
	if !ok {
		return nil, grpcNotFound("session")
	}
	url, codec, err := h.StreamStarter(ctx, req.Channel)
	if err != nil {
		return nil, err
	}
	return &StartStreamResp{RtspURL: url, Codec: codec}, nil
}

type StopStreamReq = StartStreamReq

func (s *Service) StopStream(ctx context.Context, req *StopStreamReq) (*struct{}, error) {
	h, ok := s.sm.Get(req.SessionID)
	if !ok {
		return nil, grpcNotFound("session")
	}
	return &struct{}{}, h.StreamStopper(ctx, req.Channel)
}

type PTZReq struct {
	SessionID uuid.UUID `json:"session_id"`
	Channel   int       `json:"channel"`
	Action    string    `json:"action"`
	Speed     int       `json:"speed"`
	Preset    int       `json:"preset"`
}

func (s *Service) PTZ(ctx context.Context, req *PTZReq) (*struct{}, error) {
	h, ok := s.sm.Get(req.SessionID)
	if !ok {
		return nil, grpcNotFound("session")
	}
	return &struct{}{}, h.PTZCommander(ctx, session.PTZCommand{
		Channel: req.Channel, Action: req.Action, Speed: req.Speed, Preset: req.Preset,
	})
}

type SnapshotReq = StartStreamReq
type SnapshotResp struct {
	JPEG []byte `json:"jpeg"`
}

func (s *Service) Snapshot(ctx context.Context, req *SnapshotReq) (*SnapshotResp, error) {
	h, ok := s.sm.Get(req.SessionID)
	if !ok {
		return nil, grpcNotFound("session")
	}
	b, err := h.Snapshotter(ctx, req.Channel)
	if err != nil {
		return nil, err
	}
	return &SnapshotResp{JPEG: b}, nil
}

// grpcNotFound is a stand-in for status.Error(codes.NotFound, ...).
type grpcErr struct{ msg string }

func (e *grpcErr) Error() string   { return e.msg }
func grpcNotFound(what string) error { return &grpcErr{"not found: " + what} }
