// Package crypto implements envelope encryption for device credentials.
//
// Design:
//   - A Key-Encryption-Key (KEK) is loaded once at gateway startup from
//     /etc/aion/reverse/kek.key (32 random bytes, perms 0400, owned by aion-reverse).
//   - Each secret (username, password, ISUP PSK) is encrypted with AES-256-GCM
//     using the KEK directly. Nonce is random per encryption, prepended to ciphertext.
//   - Ciphertext lives in Postgres as bytea.
//   - A future upgrade can move the KEK to AWS KMS or Vault without changing
//     the on-disk format (just the KEK source).
//
// Zero-allocation-in-hot-path is NOT a goal; correctness and auditability are.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

const (
	kekSize   = 32 // AES-256
	nonceSize = 12 // GCM standard
)

// KEK is the loaded master key. Do not log it.
type KEK struct {
	aead cipher.AEAD
}

// LoadKEK reads the key material from disk. Accepts:
//   - raw 32 bytes
//   - 64-hex-char string (with optional trailing newline)
func LoadKEK(path string) (*KEK, error) {
	st, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("kek stat: %w", err)
	}
	if st.Mode().Perm()&0o077 != 0 {
		return nil, fmt.Errorf("kek %s has loose permissions (%o); expected 0400 or 0600", path, st.Mode().Perm())
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("kek read: %w", err)
	}

	var key []byte
	trimmed := strings.TrimSpace(string(raw))
	switch {
	case len(raw) == kekSize:
		key = raw
	case len(trimmed) == 2*kekSize:
		key, err = hex.DecodeString(trimmed)
		if err != nil {
			return nil, fmt.Errorf("kek hex decode: %w", err)
		}
	default:
		return nil, fmt.Errorf("kek unexpected size: %d bytes raw / %d chars trimmed", len(raw), len(trimmed))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes init: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm init: %w", err)
	}
	return &KEK{aead: aead}, nil
}

// Encrypt returns nonce || ciphertext || tag.
func (k *KEK) Encrypt(plaintext []byte) ([]byte, error) {
	if k == nil || k.aead == nil {
		return nil, errors.New("kek not initialized")
	}
	nonce := make([]byte, nonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("rand nonce: %w", err)
	}
	ct := k.aead.Seal(nil, nonce, plaintext, nil)
	out := make([]byte, 0, len(nonce)+len(ct))
	out = append(out, nonce...)
	out = append(out, ct...)
	return out, nil
}

// Decrypt consumes the layout produced by Encrypt.
func (k *KEK) Decrypt(blob []byte) ([]byte, error) {
	if k == nil || k.aead == nil {
		return nil, errors.New("kek not initialized")
	}
	if len(blob) < nonceSize+16 {
		return nil, errors.New("ciphertext too short")
	}
	nonce, ct := blob[:nonceSize], blob[nonceSize:]
	pt, err := k.aead.Open(nil, nonce, ct, nil)
	if err != nil {
		return nil, fmt.Errorf("gcm open: %w", err)
	}
	return pt, nil
}

// GenerateKEK is a helper for operators provisioning a fresh VPS.
// Prints to stdout; caller redirects to the key file with 0400 perms.
func GenerateKEK(w io.Writer) error {
	buf := make([]byte, kekSize)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return err
	}
	_, err := fmt.Fprintln(w, hex.EncodeToString(buf))
	return err
}
