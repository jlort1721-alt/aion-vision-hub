//go:build !sdk_dahua

package dahua

import (
	"context"
	"net/netip"
)

// NewClient returns a stub that always reports the SDK is disabled.
// This keeps the rest of the codebase compilable on machines that do not
// have the proprietary Dahua binaries available (CI, dev laptops).
func NewClient() Client { return stubClient{} }

type stubClient struct{}

func (stubClient) Init() error                                                        { return ErrSDKDisabled }
func (stubClient) ListenServer(string, RegisterCallback) error                        { return ErrSDKDisabled }
func (stubClient) LoginReverse(string, string, string) (LoginHandle, error)           { return 0, ErrSDKDisabled }
func (stubClient) StartRealPlay(LoginHandle, int, bool) (EsStream, error)             { return nil, ErrSDKDisabled }
func (stubClient) PTZControl(LoginHandle, int, string, int, int) error                { return ErrSDKDisabled }
func (stubClient) Snapshot(LoginHandle, int) ([]byte, error)                          { return nil, ErrSDKDisabled }
func (stubClient) SubscribeEvents(context.Context, LoginHandle) (<-chan EventPayload, error) {
	ch := make(chan EventPayload)
	close(ch)
	return ch, ErrSDKDisabled
}
func (stubClient) Logout(LoginHandle) error { return ErrSDKDisabled }
func (stubClient) Shutdown() error          { return nil }

// ensure the exported symbol exists when stub is compiled
var _ = netip.AddrPort{}
