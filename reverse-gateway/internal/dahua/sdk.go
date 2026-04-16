// Package dahua implements the DVRIP reverse-registration listener.
//
// The file layout separates concerns:
//   - sdk.go: a small Client interface and a concrete cgo-backed
//     implementation wrapping Dahua's NetSDK. Tests use a fake.
//   - listener.go: accepts auto-register callbacks, looks up devices,
//     performs login, opens streams on demand.
//   - ptz.go, events.go, media.go: protocol-specific helpers.
//
// Build: requires Dahua General_NetSDK (Linux x86_64) placed at
//   sdks/dahua/lib/libdhnetsdk.so + libdhconfigsdk.so + libNetFramework.so
//   sdks/dahua/include/*.h
//
// Build tag "sdk_dahua" enables cgo; without it, a stub is compiled so the
// rest of the codebase (and tests) build on machines without the SDK.
package dahua

import (
	"context"
	"errors"
	"net/netip"
)

// Client is what listener.go consumes. Concrete impl is cgo-backed.
type Client interface {
	// Init boots the SDK and registers global callbacks. Idempotent.
	Init() error

	// ListenServer starts the DVRIP reverse-register TCP server on addr.
	// When a device connects and announces itself, cb is invoked with the
	// declared deviceID and remote addr. The callback should return an
	// approved bool; if false, the SDK politely closes the TCP conn.
	ListenServer(addr string, cb RegisterCallback) error

	// LoginReverse authenticates to the already-connected device and returns
	// an opaque login handle used for subsequent operations.
	LoginReverse(deviceID, user, pass string) (LoginHandle, error)

	// StartRealPlay opens the main or sub stream on the given channel and
	// returns a ReadCloser yielding raw elementary stream bytes (H.264/H.265 + AAC).
	StartRealPlay(h LoginHandle, channel int, sub bool) (EsStream, error)

	// PTZControl dispatches a PTZ command.
	PTZControl(h LoginHandle, channel int, cmd string, speed int, extra int) error

	// Snapshot returns a JPEG from the given channel.
	Snapshot(h LoginHandle, channel int) ([]byte, error)

	// SubscribeEvents opens the alarm/event channel; delivers JSON payloads
	// to the returned channel until ctx is cancelled.
	SubscribeEvents(ctx context.Context, h LoginHandle) (<-chan EventPayload, error)

	// Logout / Cleanup.
	Logout(h LoginHandle) error
	Shutdown() error
}

type RegisterCallback func(deviceID string, addr netip.AddrPort) (approved bool)

type LoginHandle uintptr

type EsStream interface {
	Read(p []byte) (int, error)
	Close() error
}

type EventPayload struct {
	Channel int
	Kind    string
	JSON    []byte
}

// ErrSDKDisabled is returned by the stub client when the gateway is built
// without the sdk_dahua build tag. Useful for CI / dev machines.
var ErrSDKDisabled = errors.New("dahua SDK disabled in this build (missing build tag sdk_dahua)")
