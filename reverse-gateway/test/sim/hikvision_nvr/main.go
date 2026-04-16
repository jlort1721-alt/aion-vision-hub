// test/sim/hikvision_nvr/main.go
//
// Fake Hikvision NVR that speaks a simplified ISUP 5.0 registration
// handshake. Same disclaimers as dahua_xvr/main.go — targets the stub
// gateway for CI; full-fidelity media replay is out of scope.

package main

import (
	"context"
	"encoding/json"
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
	sigAddr   = flag.String("signaling", "127.0.0.1:7660", "gateway signaling addr")
	streamAddr = flag.String("stream", "127.0.0.1:7661", "gateway stream addr")
	deviceID  = flag.String("device-id", "SIM-NVR-001", "unique device id")
	isupKey   = flag.String("isup-key", "simkey123456", "ISUP shared key")
	firmware  = flag.String("firmware", "V4.72.115 build 230911", "firmware version")
	heartbeat = flag.Duration("heartbeat", 20*time.Second, "heartbeat interval")
	verbose   = flag.Bool("v", false, "verbose")
)

type registerMsg struct {
	MagicNumber string `json:"MN"`
	DeviceID    string `json:"DID"`
	ISUPKey     string `json:"DK"`
	Firmware    string `json:"FW"`
	Channels    int    `json:"CH"`
	Proto       string `json:"PR"`
}

type heartbeatMsg struct {
	DeviceID string `json:"DID"`
	Type     string `json:"T"`
	TS       int64  `json:"TS"`
}

func main() {
	flag.Parse()

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer cancel()

	for {
		if err := runOne(ctx); err != nil {
			log.Printf("run: %v; retrying in 5s", err)
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
	conn, err := dialer.DialContext(ctx, "tcp", *sigAddr)
	if err != nil {
		return fmt.Errorf("dial sig: %w", err)
	}
	defer conn.Close()
	log.Printf("sig connected to %s as %s (fw=%s)", *sigAddr, *deviceID, *firmware)

	// Register
	reg := registerMsg{
		MagicNumber: "ISUP5",
		DeviceID:    *deviceID,
		ISUPKey:     *isupKey,
		Firmware:    *firmware,
		Channels:    8,
		Proto:       "5.0",
	}
	if err := writeJSON(conn, "REGISTER", reg); err != nil {
		return err
	}

	// Open stream conn (ISUP separates signaling and media)
	strConn, err := dialer.DialContext(ctx, "tcp", *streamAddr)
	if err != nil {
		return fmt.Errorf("dial stream: %w", err)
	}
	defer strConn.Close()
	log.Printf("stream channel open to %s", *streamAddr)

	var wg sync.WaitGroup
	wg.Add(2)
	ctx2, cancel := context.WithCancel(ctx)
	defer cancel()

	go func() {
		defer wg.Done()
		t := time.NewTicker(*heartbeat)
		defer t.Stop()
		for {
			select {
			case <-ctx2.Done():
				return
			case <-t.C:
				hb := heartbeatMsg{DeviceID: *deviceID, Type: "HB", TS: time.Now().Unix()}
				if err := writeJSON(conn, "HEARTBEAT", hb); err != nil {
					log.Printf("hb: %v", err)
					cancel()
					return
				}
				if *verbose {
					log.Printf("heartbeat")
				}
			}
		}
	}()

	go func() {
		defer wg.Done()
		if err := readLoop(conn); err != nil && err != io.EOF {
			log.Printf("sig read: %v", err)
		}
		cancel()
	}()

	wg.Wait()
	return nil
}

func writeJSON(w io.Writer, op string, v any) error {
	body, err := json.Marshal(v)
	if err != nil {
		return err
	}
	frame := fmt.Sprintf("ISUP/1.0 %s\r\nContent-Length: %d\r\n\r\n%s", op, len(body), body)
	_, err = w.Write([]byte(frame))
	return err
}

func readLoop(r io.Reader) error {
	buf := make([]byte, 4096)
	for {
		n, err := r.Read(buf)
		if err != nil {
			return err
		}
		if *verbose {
			log.Printf("< %d bytes", n)
		}
	}
}

func init() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.SetOutput(os.Stderr)
}
