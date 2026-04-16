// cmd/keygen/main.go
//
// Prints a fresh 32-byte KEK as hex. Redirect to the key file:
//
//   make keygen > /etc/aion/reverse/kek.key
//   chmod 0400  /etc/aion/reverse/kek.key
//   chown aion-reverse:aion /etc/aion/reverse/kek.key
//
// IMPORTANT: Do this ONCE on the production VPS. If you ever rotate the key,
// you must also re-encrypt every device credential row under the new KEK.
package main

import (
	"fmt"
	"os"

	"github.com/claveseg/aion/reverse-gateway/internal/crypto"
)

func main() {
	if err := crypto.GenerateKEK(os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "keygen:", err)
		os.Exit(1)
	}
}
