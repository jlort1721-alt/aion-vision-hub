//go:build !sdk_hikvision

package hikvision

import "context"

func NewClient() Client { return stubClient{} }

type stubClient struct{}

func (stubClient) Init() error                                                 { return ErrSDKDisabled }
func (stubClient) StartServer(string, string, RegisterCallback) error          { return ErrSDKDisabled }
func (stubClient) LoginReverse(string, string) (LoginHandle, error)            { return 0, ErrSDKDisabled }
func (stubClient) StartRealStream(LoginHandle, int, bool) (EsStream, error)    { return nil, ErrSDKDisabled }
func (stubClient) PTZControl(LoginHandle, int, string, int, int) error         { return ErrSDKDisabled }
func (stubClient) Snapshot(LoginHandle, int) ([]byte, error)                   { return nil, ErrSDKDisabled }
func (stubClient) SubscribeAlarms(context.Context, LoginHandle) (<-chan EventPayload, error) {
	ch := make(chan EventPayload)
	close(ch)
	return ch, ErrSDKDisabled
}
func (stubClient) Logout(LoginHandle) error { return ErrSDKDisabled }
func (stubClient) Shutdown() error          { return nil }
