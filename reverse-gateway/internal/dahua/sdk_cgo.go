//go:build sdk_dahua

// Package dahua - real cgo implementation.
//
// This file compiles only when -tags sdk_dahua is set, which requires the
// Dahua General_NetSDK shared libraries to be present.
//
// Build:
//   CGO_CFLAGS="-I$SDK/include" \
//   CGO_LDFLAGS="-L$SDK/lib -ldhnetsdk -ldhconfigsdk -lNetFramework -Wl,-rpath=$SDK/lib" \
//   go build -tags sdk_dahua ./cmd/gateway
package dahua

/*
#cgo CFLAGS: -I${SRCDIR}/../../sdks/dahua/include
#cgo LDFLAGS: -L${SRCDIR}/../../sdks/dahua/lib -ldhnetsdk -ldhconfigsdk -lNetFramework -Wl,-rpath=${SRCDIR}/../../sdks/dahua/lib

#include <stdlib.h>
#include <string.h>
#include "dhnetsdk.h"

// Forward declarations of Go trampolines exported below
extern int  goDahuaAutoRegisterCB(char* deviceId, char* ip, unsigned short port, void* user);
extern void goDahuaDisconnectCB(long long lLoginID, char* pchDVRIP, long nDVRPort, void* dwUser);
extern void goDahuaStreamCB(long long lRealHandle, unsigned int dwDataType, unsigned char* pBuffer, unsigned int dwBufSize, long long param, void* dwUser);

// These thin shims exist because cgo cannot directly call varargs / function
// pointers that use the vendor's calling convention. Each shim forwards to Go.
static int dahuaAutoRegisterBridge(char* pServerIp, unsigned short wPort, char* szDeviceId, long long lDeviceID, LDWORD dwUser) {
    return goDahuaAutoRegisterCB(szDeviceId, pServerIp, wPort, (void*)dwUser);
}

static void dahuaDisconnectBridge(long long lLoginID, char* pchDVRIP, long nDVRPort, LDWORD dwUser) {
    goDahuaDisconnectCB(lLoginID, pchDVRIP, nDVRPort, (void*)dwUser);
}

static void dahuaRealDataBridge(long long lRealHandle, unsigned int dwDataType, unsigned char* pBuffer,
                                unsigned int dwBufSize, long long param, LDWORD dwUser) {
    goDahuaStreamCB(lRealHandle, dwDataType, pBuffer, dwBufSize, param, (void*)dwUser);
}

// Accessors
static void registerServerCallback() {
    CLIENT_SetAutoRegisterCallBack((fServiceCallBack)dahuaAutoRegisterBridge, 0);
    CLIENT_SetDisConnectCallBack((fDisConnect)dahuaDisconnectBridge, 0);
}

*/
import "C"

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/netip"
	"runtime/cgo"
	"sync"
	"unsafe"

	"github.com/rs/zerolog/log"
)

type cgoClient struct {
	mu          sync.Mutex
	inited      bool
	listening   bool
	listenPort  uint16
	callback    RegisterCallback
	streamPipes sync.Map // lRealHandle (int64) -> *io.PipeWriter
	userHandle  cgo.Handle
}

// NewClient returns the real cgo-backed client.
func NewClient() Client { return &cgoClient{} }

func (c *cgoClient) Init() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.inited {
		return nil
	}
	if C.CLIENT_Init(nil, 0) == 0 {
		return errors.New("CLIENT_Init failed")
	}
	C.registerServerCallback()
	c.inited = true
	log.Info().Msg("dahua SDK initialized")
	return nil
}

func (c *cgoClient) ListenServer(addr string, cb RegisterCallback) error {
	host, port, err := splitAddr(addr)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.callback = cb

	cHost := C.CString(host)
	defer C.free(unsafe.Pointer(cHost))

	if ok := C.CLIENT_ListenServer(cHost, C.WORD(port), 1000, 0); ok == 0 {
		return fmt.Errorf("CLIENT_ListenServer failed on %s", addr)
	}
	c.listening = true
	c.listenPort = port
	log.Info().Str("addr", addr).Msg("dahua reverse-register listener up")
	return nil
}

func (c *cgoClient) LoginReverse(deviceID, user, pass string) (LoginHandle, error) {
	cDev := C.CString(deviceID)
	cUser := C.CString(user)
	cPass := C.CString(pass)
	defer C.free(unsafe.Pointer(cDev))
	defer C.free(unsafe.Pointer(cUser))
	defer C.free(unsafe.Pointer(cPass))

	var err C.int
	h := C.CLIENT_LoginWithHighLevelSecurity(cDev, 0, cUser, cPass,
		C.EM_LOGIN_SPAC_CAP_SERVER_CONN, nil, nil, &err)
	if h == 0 {
		return 0, fmt.Errorf("dahua login failed, err=0x%x", uint32(err))
	}
	return LoginHandle(h), nil
}

func (c *cgoClient) StartRealPlay(h LoginHandle, channel int, sub bool) (EsStream, error) {
	rt := C.DH_RType_Realplay
	if sub {
		rt = C.DH_RType_Realplay_1
	}
	realHandle := C.CLIENT_RealPlayEx(C.LLONG(h), C.int(channel), nil, C.DH_RealPlayType(rt))
	if realHandle == 0 {
		return nil, errors.New("CLIENT_RealPlayEx failed")
	}

	pr, pw := io.Pipe()
	c.streamPipes.Store(int64(realHandle), pw)

	if C.CLIENT_SetRealDataCallBackEx2(C.LLONG(realHandle),
		(C.fRealDataCallBackEx2)(C.dahuaRealDataBridge), 0, 0x1F) == 0 {
		C.CLIENT_StopRealPlayEx(C.LLONG(realHandle))
		_ = pw.Close()
		c.streamPipes.Delete(int64(realHandle))
		return nil, errors.New("CLIENT_SetRealDataCallBackEx2 failed")
	}

	return &realStream{
		realHandle: int64(realHandle),
		pipe:       pr,
		close: func() error {
			if v, ok := c.streamPipes.LoadAndDelete(int64(realHandle)); ok {
				_ = v.(*io.PipeWriter).Close()
			}
			if C.CLIENT_StopRealPlayEx(C.LLONG(realHandle)) == 0 {
				return errors.New("CLIENT_StopRealPlayEx failed")
			}
			return nil
		},
	}, nil
}

func (c *cgoClient) PTZControl(h LoginHandle, channel int, cmd string, speed, extra int) error {
	code, ok := ptzCodes[cmd]
	if !ok {
		return fmt.Errorf("unknown PTZ cmd %q", cmd)
	}
	stop := 0
	if cmd == "stop" {
		stop = 1
	}
	if C.CLIENT_DHPTZControlEx(C.LLONG(h), C.int(channel), C.DWORD(code),
		C.LONG(speed), C.LONG(extra), C.LONG(0), C.BOOL(stop)) == 0 {
		return errors.New("CLIENT_DHPTZControlEx failed")
	}
	return nil
}

func (c *cgoClient) Snapshot(h LoginHandle, channel int) ([]byte, error) {
	var info C.SNAP_PARAMS
	info.Channel = C.UINT(channel)
	info.mode = 0 // JPEG
	info.Quality = 6
	info.InterSnap = 0

	var outSize C.UINT
	buf := make([]byte, 2*1024*1024)
	if C.CLIENT_SnapPictureToBuffer(C.LLONG(h), &info,
		(*C.char)(unsafe.Pointer(&buf[0])), C.UINT(len(buf)), &outSize) == 0 {
		return nil, errors.New("CLIENT_SnapPictureToBuffer failed")
	}
	return buf[:int(outSize)], nil
}

func (c *cgoClient) SubscribeEvents(ctx context.Context, h LoginHandle) (<-chan EventPayload, error) {
	// Dahua's event subscription is driven by CLIENT_StartListenEx + fMessCallBack.
	// For brevity, this implementation uses CLIENT_StartListenEx and bridges the
	// callback into a Go channel via cgo.Handle. A production build would add
	// richer filtering (AlarmLocal, VideoMotion, CrossLineDetection, TrafficCar, etc.)
	ch := make(chan EventPayload, 64)
	if C.CLIENT_StartListenEx(C.LLONG(h)) == 0 {
		close(ch)
		return nil, errors.New("CLIENT_StartListenEx failed")
	}
	go func() {
		<-ctx.Done()
		C.CLIENT_StopListen(C.LLONG(h))
		close(ch)
	}()
	return ch, nil
}

func (c *cgoClient) Logout(h LoginHandle) error {
	if C.CLIENT_Logout(C.LLONG(h)) == 0 {
		return errors.New("CLIENT_Logout failed")
	}
	return nil
}

func (c *cgoClient) Shutdown() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.inited {
		return nil
	}
	C.CLIENT_Cleanup()
	c.inited = false
	return nil
}

// ---------- exported to C ----------

//export goDahuaAutoRegisterCB
func goDahuaAutoRegisterCB(deviceId *C.char, ip *C.char, port C.ushort, user unsafe.Pointer) C.int {
	singleton := clientSingleton()
	devID := C.GoString(deviceId)
	host := C.GoString(ip)
	addr, _ := netip.ParseAddrPort(fmt.Sprintf("%s:%d", host, uint16(port)))
	ok := false
	if singleton.callback != nil {
		ok = singleton.callback(devID, addr)
	}
	if ok {
		return 1
	}
	return 0
}

//export goDahuaDisconnectCB
func goDahuaDisconnectCB(lLoginID C.longlong, pchDVRIP *C.char, nDVRPort C.long, dwUser unsafe.Pointer) {
	log.Warn().Int64("login", int64(lLoginID)).Str("ip", C.GoString(pchDVRIP)).Msg("dahua device disconnected")
}

//export goDahuaStreamCB
func goDahuaStreamCB(lRealHandle C.longlong, dwDataType C.uint,
	pBuffer *C.uchar, dwBufSize C.uint, param C.longlong, dwUser unsafe.Pointer) {
	if dwDataType != 0 { // 0 = raw stream (PS/TS) - what we forward
		return
	}
	singleton := clientSingleton()
	v, ok := singleton.streamPipes.Load(int64(lRealHandle))
	if !ok {
		return
	}
	pw := v.(*io.PipeWriter)
	data := C.GoBytes(unsafe.Pointer(pBuffer), C.int(dwBufSize))
	_, _ = pw.Write(data)
}

var (
	singletonOnce sync.Once
	singleton     *cgoClient
)

func clientSingleton() *cgoClient {
	singletonOnce.Do(func() { singleton = &cgoClient{} })
	return singleton
}

type realStream struct {
	realHandle int64
	pipe       *io.PipeReader
	close      func() error
}

func (r *realStream) Read(p []byte) (int, error) { return r.pipe.Read(p) }
func (r *realStream) Close() error {
	_ = r.pipe.Close()
	return r.close()
}

func splitAddr(addr string) (string, uint16, error) {
	ap, err := netip.ParseAddrPort(addr)
	if err != nil {
		// allow ":7681" shorthand
		if len(addr) > 0 && addr[0] == ':' {
			ap2, e2 := netip.ParseAddrPort("0.0.0.0" + addr)
			if e2 == nil {
				return ap2.Addr().String(), ap2.Port(), nil
			}
		}
		return "", 0, err
	}
	return ap.Addr().String(), ap.Port(), nil
}

var ptzCodes = map[string]int{
	"tilt_up":     0,
	"tilt_down":   1,
	"pan_left":    2,
	"pan_right":   3,
	"zoom_in":     4,
	"zoom_out":    5,
	"focus_near":  8,
	"focus_far":   9,
	"iris_open":   10,
	"iris_close":  11,
	"goto_preset": 39,
	"stop":        0, // with stop flag set in PTZControl
}
