// Package hikvision implements the ISUP 5.0 (ex-EHome) reverse-registration
// listener for Hikvision DVR/NVR/IPC devices.
//
// ISUP differs from Dahua's DVRIP in two important ways:
//   1. Authentication uses a pre-shared key (the "ISUP key" set on the device).
//   2. Media transport runs on a SEPARATE port (default :7661) while
//      signaling/registration lives on :7660.
//
// Otherwise the shape of the API is intentionally symmetric to dahua.Client.
package hikvision

import (
	"context"
	"errors"
	"net/netip"
)

type Client interface {
	Init() error
	StartServer(signalingAddr, streamAddr string, cb RegisterCallback) error
	LoginReverse(deviceID, isupKey string) (LoginHandle, error)
	StartRealStream(h LoginHandle, channel int, sub bool) (EsStream, error)
	PTZControl(h LoginHandle, channel int, cmd string, speed int, extra int) error
	Snapshot(h LoginHandle, channel int) ([]byte, error)
	SubscribeAlarms(ctx context.Context, h LoginHandle) (<-chan EventPayload, error)
	Logout(h LoginHandle) error
	Shutdown() error
}

type RegisterCallback func(deviceID string, addr netip.AddrPort, firmware string) (approved bool)

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

var ErrSDKDisabled = errors.New("hikvision SDK disabled in this build (missing build tag sdk_hikvision)")
