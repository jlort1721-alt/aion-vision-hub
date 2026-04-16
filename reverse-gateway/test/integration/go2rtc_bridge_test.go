// reverse-gateway/test/integration/go2rtc_bridge_test.go
package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/claveseg/aion/reverse-gateway/internal/media"
)

type fakeGo2RTC struct {
	mu      sync.Mutex
	streams map[string]string // name -> src
}

func newFake() *fakeGo2RTC { return &fakeGo2RTC{streams: map[string]string{}} }

func (f *fakeGo2RTC) handler(t *testing.T) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"go2rtc":{"version":"1.9.2"}}`))
	})
	mux.HandleFunc("/api/streams", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut:
			name := r.URL.Query().Get("name")
			src := r.URL.Query().Get("src")
			f.mu.Lock()
			f.streams[name] = src
			f.mu.Unlock()
			w.WriteHeader(http.StatusOK)
		case http.MethodDelete:
			name := r.URL.Query().Get("src")
			f.mu.Lock()
			delete(f.streams, name)
			f.mu.Unlock()
			w.WriteHeader(http.StatusOK)
		case http.MethodGet:
			f.mu.Lock()
			defer f.mu.Unlock()
			out := map[string]any{}
			for k := range f.streams {
				out[k] = map[string]any{}
			}
			_ = json.NewEncoder(w).Encode(out)
		default:
			http.Error(w, "method", http.StatusMethodNotAllowed)
		}
	})
	return mux
}

func TestGo2RTCBridge_Lifecycle(t *testing.T) {
	fake := newFake()
	srv := httptest.NewServer(fake.handler(t))
	defer srv.Close()

	br := media.NewGo2RTCBridge(srv.URL, "rv_")
	ctx := context.Background()

	if err := br.Ping(ctx); err != nil {
		t.Fatalf("ping: %v", err)
	}
	if err := br.AddStream(ctx, "rv_dahua_XVR001_ch1", "rtsp://127.0.0.1:8554/x"); err != nil {
		t.Fatal(err)
	}
	list, err := br.ListReverseStreams(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 stream, got %v", list)
	}
	if err := br.RemoveStream(ctx, "rv_dahua_XVR001_ch1"); err != nil {
		t.Fatal(err)
	}
	list, _ = br.ListReverseStreams(ctx)
	if len(list) != 0 {
		t.Fatalf("expected cleanup, got %v", list)
	}
}

func TestGo2RTCBridge_RefusesUnprefixed(t *testing.T) {
	srv := httptest.NewServer(newFake().handler(t))
	defer srv.Close()
	br := media.NewGo2RTCBridge(srv.URL, "rv_")

	if err := br.AddStream(context.Background(), "existing_cam_1", "rtsp://..."); err == nil {
		t.Fatal("bridge must refuse to touch streams outside its namespace")
	}
	if err := br.RemoveStream(context.Background(), "existing_cam_1"); err == nil {
		t.Fatal("bridge must refuse to delete streams outside its namespace")
	}
}

func TestGo2RTCBridge_NamespaceCollisionDetection(t *testing.T) {
	fake := newFake()
	fake.streams["rv_legacy_ghost"] = "rtsp://x" // pretend something is squatting
	srv := httptest.NewServer(fake.handler(t))
	defer srv.Close()

	br := media.NewGo2RTCBridge(srv.URL, "rv_")
	// Known existing streams should normally not include our prefix. If they do,
	// SanityCheck must fail — that's the guardrail.
	err := br.SanityCheckNamespace(context.Background(), []string{"rv_legacy_ghost"})
	if err == nil {
		t.Fatal("expected namespace-collision error")
	}
}
