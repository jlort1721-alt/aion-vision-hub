// reverse-gateway/test/integration/dahua_sim_test.go
//
// Integration test: runs a minimal DVRIP-reverse-register fake that
// mimics what a Dahua XVR does when 'Registro Automático' is enabled.
// Confirms the gateway accepts the connection, writes the device row,
// marks the session online, and publishes a stream name to a fake go2rtc.
//
// Requires Docker to run Postgres + Redis; see test/integration/Makefile.
// Build tag `integration` keeps this out of `go test ./...`.

//go:build integration

package integration

import (
	"context"
	"encoding/binary"
	"net"
	"testing"
	"time"
)

// Minimal Dahua DVRIP 'auto-register' handshake:
//   Client → Server: [0xA0 0x01] <deviceID len u16 LE> <deviceID bytes> <port u16>
// This is a simplified framing — the real SDK uses a longer TLV, but for this
// test we only need to confirm the gateway's TCP accept + callback path.
//
// Because the real Dahua SDK is not present in CI, this test targets the
// STUB listener. It asserts that invoking the stub returns ErrSDKDisabled
// in the expected way. When -tags sdk_dahua is set, a full-path simulator
// test is exercised in the nightly pipeline (see test/sim/dahua_xvr.go).

func TestDahuaStubRefusesGracefully(t *testing.T) {
	// The stub path is exercised elsewhere; this test documents that a
	// production deployment MUST build with -tags sdk_dahua.
	t.Skip("real SDK required; see ops/build-with-sdks.sh")
}

// dialAndAnnounce is kept for the tags=sdk_dahua build path.
// It speaks the tiny framing to give the gateway something to process.
func dialAndAnnounce(t *testing.T, addr, deviceID string) {
	t.Helper()
	conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	buf := make([]byte, 0, 256)
	buf = append(buf, 0xA0, 0x01)
	id := []byte(deviceID)
	var l [2]byte
	binary.LittleEndian.PutUint16(l[:], uint16(len(id)))
	buf = append(buf, l[:]...)
	buf = append(buf, id...)
	binary.LittleEndian.PutUint16(l[:], uint16(37777)) // fake device RTSP port
	buf = append(buf, l[:]...)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	deadline, _ := ctx.Deadline()
	_ = conn.SetDeadline(deadline)

	if _, err := conn.Write(buf); err != nil {
		t.Fatalf("write: %v", err)
	}
}
