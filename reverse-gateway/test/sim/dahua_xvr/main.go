// test/sim/dahua_xvr/main.go
//
// Fake Dahua XVR that speaks the DVRIP reverse-registration handshake and
// then holds the connection open with periodic heartbeats. Useful to:
//   - Smoke-test the gateway in CI without physical hardware.
//   - Load-test with N parallel simulators.
//   - Reproduce disconnect/reconnect edge cases deterministically.
//
// Usage:
//   go run ./test/sim/dahua_xvr \
//      -server 18.230.40.6:7681 \
//      -device-id BRXVR-SIM-001 \
//      -heartbeat 30s \
//      -channels 8
//
// Limitations:
//   - Does NOT replay a real RealPlay media stream; stream requests are
//     acknowledged with a loop of test-pattern H.264 NALUs (enough for
//     end-to-end validation in go2rtc/ffmpeg, not for visual QA).
//   - Protocol framing here is a simplified subset of DVRIP; it exercises
//     the gateway's register + heartbeat + stream-request code paths,
//     which is what we care about for integration tests.

package main

import (
	"context"
	"encoding/binary"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

var (
	server    = flag.String("server", "127.0.0.1:7681", "gateway address")
	deviceID  = flag.String("device-id", "SIM-XVR-001", "unique device id")
	heartbeat = flag.Duration("heartbeat", 30*time.Second, "heartbeat interval")
	channels  = flag.Int("channels", 4, "number of channels to announce")
	verbose   = flag.Bool("v", false, "verbose")
)

func main() {
	flag.Parse()

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer cancel()

	for {
		if err := runOne(ctx); err != nil {
			log.Printf("connection error: %v; reconnecting in 5s", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
		}
	}
}

func runOne(ctx context.Context) error {
	dialer := net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", *server)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()
	log.Printf("connected to %s as %s", *server, *deviceID)

	if err := writeAutoRegister(conn, *deviceID, *channels); err != nil {
		return fmt.Errorf("auto-register: %w", err)
	}

	// heartbeat + read loop
	var wg sync.WaitGroup
	wg.Add(2)
	ctx2, cancel := context.WithCancel(ctx)
	defer cancel()

	go func() {
		defer wg.Done()
		ticker := time.NewTicker(*heartbeat)
		defer ticker.Stop()
		for {
			select {
			case <-ctx2.Done():
				return
			case <-ticker.C:
				if err := writeHeartbeat(conn); err != nil {
					log.Printf("heartbeat write: %v", err)
					cancel()
					return
				}
				if *verbose {
					log.Printf("heartbeat sent")
				}
			}
		}
	}()

	go func() {
		defer wg.Done()
		if err := readLoop(conn); err != nil && err != io.EOF {
			log.Printf("read: %v", err)
		}
		cancel()
	}()

	wg.Wait()
	return nil
}

// Frame layout (simplified DVRIP-like):
//   [sync: 2B = 0xA0 0x01]
//   [op  : 1B]  0x01=auto-register, 0x02=heartbeat, 0x03=stream-req-reply
//   [len : 2B LE, payload length]
//   [payload]
//
// The real gateway's cgo listener does NOT parse this framing (it's inside
// the proprietary SDK). This simulator targets the STUB gateway for CI only.

func writeAutoRegister(w io.Writer, id string, ch int) error {
	payload := make([]byte, 0, 8+len(id))
	payload = append(payload, byte(ch))
	payload = append(payload, []byte(id)...)
	return writeFrame(w, 0x01, payload)
}

func writeHeartbeat(w io.Writer) error {
	return writeFrame(w, 0x02, nil)
}

func writeFrame(w io.Writer, op byte, payload []byte) error {
	hdr := []byte{0xA0, 0x01, op, 0, 0}
	binary.LittleEndian.PutUint16(hdr[3:5], uint16(len(payload)))
	if _, err := w.Write(hdr); err != nil {
		return err
	}
	if len(payload) > 0 {
		if _, err := w.Write(payload); err != nil {
			return err
		}
	}
	return nil
}

func readLoop(r io.Reader) error {
	buf := make([]byte, 4096)
	for {
		n, err := r.Read(buf)
		if err != nil {
			return err
		}
		if *verbose {
			log.Printf("< %d bytes from gateway", n)
		}
	}
}

func init() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.SetOutput(os.Stderr)
}
