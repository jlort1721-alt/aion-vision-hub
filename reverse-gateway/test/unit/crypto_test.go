// reverse-gateway/test/unit/crypto_test.go
package unit

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"

	"github.com/claveseg/aion/reverse-gateway/internal/crypto"
)

func writeKey(t *testing.T, hexStr string, perm os.FileMode) string {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, "kek.key")
	if err := os.WriteFile(p, []byte(hexStr), perm); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestKEKRoundTrip(t *testing.T) {
	raw := make([]byte, 32)
	_, _ = rand.Read(raw)
	path := writeKey(t, hex.EncodeToString(raw), 0o400)

	kek, err := crypto.LoadKEK(path)
	if err != nil {
		t.Fatal(err)
	}

	for _, plaintext := range [][]byte{
		nil,
		[]byte("hello"),
		[]byte("password-with-specials-!@#$"),
		bytes.Repeat([]byte("A"), 4096),
	} {
		ct, err := kek.Encrypt(plaintext)
		if err != nil {
			t.Fatalf("encrypt: %v", err)
		}
		pt, err := kek.Decrypt(ct)
		if err != nil {
			t.Fatalf("decrypt: %v", err)
		}
		if !bytes.Equal(pt, plaintext) {
			t.Fatalf("roundtrip mismatch: got %q want %q", pt, plaintext)
		}
	}
}

func TestKEKRejectsLoosePerms(t *testing.T) {
	raw := hex.EncodeToString(bytes.Repeat([]byte{0x42}, 32))
	path := writeKey(t, raw, 0o644)
	if _, err := crypto.LoadKEK(path); err == nil {
		t.Fatal("expected error for 0644 perms")
	}
}

func TestKEKRejectsShortCiphertext(t *testing.T) {
	raw := hex.EncodeToString(bytes.Repeat([]byte{0x42}, 32))
	path := writeKey(t, raw, 0o400)
	kek, err := crypto.LoadKEK(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := kek.Decrypt([]byte("short")); err == nil {
		t.Fatal("expected error on short ciphertext")
	}
}

func TestKEKTamperDetection(t *testing.T) {
	raw := hex.EncodeToString(bytes.Repeat([]byte{0x42}, 32))
	path := writeKey(t, raw, 0o400)
	kek, _ := crypto.LoadKEK(path)

	ct, _ := kek.Encrypt([]byte("secret"))
	ct[len(ct)-1] ^= 0xFF // flip last byte
	if _, err := kek.Decrypt(ct); err == nil {
		t.Fatal("GCM must reject tampered ciphertext")
	}
}
