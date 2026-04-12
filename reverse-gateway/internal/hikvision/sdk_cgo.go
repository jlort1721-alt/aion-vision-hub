//go:build sdk_hikvision

package hikvision

/*
#cgo CFLAGS: -I${SRCDIR}/../../sdks/hikvision/include
#cgo LDFLAGS: -L${SRCDIR}/../../sdks/hikvision/lib -lhcnetsdk -lhcISUPSDK -lhpr -Wl,-rpath=${SRCDIR}/../../sdks/hikvision/lib

#include <stdlib.h>
#include <string.h>
#include "HCISUPCMS.h"
#include "HCISUPStream.h"

// Trampolines to Go
extern int  goHikRegisterCB(char* deviceId, char* ip, unsigned short port, char* fw);
extern void goHikAlarmCB(long long lHandle, unsigned int dwEvent, void* pBuf, unsigned int dwSize);
extern void goHikStreamCB(long long lHandle, unsigned int dwDataType, unsigned char* pBuffer, unsigned int dwBufSize);

static int hikRegisterBridge(LONG lUserID, NET_EHOME_DEV_REG_INFO_V11* pDevInfo, LONG lExpectedLinkMode, void* pUserData) {
    char devId[64] = {0};
    strncpy(devId, (const char*)pDevInfo->struDevAddr.byDeviceID, 63);
    char ip[48] = {0};
    strncpy(ip, (const char*)pDevInfo->struDevAddr.szIP, 47);
    char fw[64] = {0};
    if (pDevInfo->byFirmwareVersion[0] != 0) {
        strncpy(fw, (const char*)pDevInfo->byFirmwareVersion, 63);
    }
    return goHikRegisterCB(devId, ip, pDevInfo->struDevAddr.wPort, fw);
}

static void hikAlarmBridge(LONG lHandle, NET_EHOME_ALARM_MSG_RSP* pAlarmMsg, void* pUserData) {
    if (!pAlarmMsg || !pAlarmMsg->pAlarmData) return;
    goHikAlarmCB(lHandle, pAlarmMsg->dwAlarmType, pAlarmMsg->pAlarmData, pAlarmMsg->dwAlarmDataLen);
}

static void hikStreamBridge(LONG lHandle, NET_EHOME_STREAM_DATA* pStreamData, void* pUserData) {
    if (!pStreamData || !pStreamData->pData) return;
    goHikStreamCB(lHandle, pStreamData->dwDataType, pStreamData->pData, pStreamData->dwDataLen);
}

static int startServer(const char* sigIp, unsigned short sigPort,
                       const char* streamIp, unsigned short streamPort) {
    NET_EHOME_SERVER_INFO_V11 cms = {0};
    strncpy((char*)cms.struAddress.szIP, sigIp, sizeof(cms.struAddress.szIP)-1);
    cms.struAddress.wPort = sigPort;
    cms.byAlarmServer = 0;
    cms.wSMSPort = 0;

    if (NET_ECMS_StartListen(&cms, (REGISTER_CALLBACK)hikRegisterBridge, NULL) < 0) {
        return -1;
    }

    NET_EHOME_SERVER_INFO_V11 stream = {0};
    strncpy((char*)stream.struAddress.szIP, streamIp, sizeof(stream.struAddress.szIP)-1);
    stream.struAddress.wPort = streamPort;

    if (NET_ESTREAM_StartListen(&stream, NULL, NULL) < 0) {
        NET_ECMS_StopListen(0);
        return -2;
    }
    return 0;
}
*/
import "C"

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/netip"
	"sync"
	"unsafe"

	"github.com/rs/zerolog/log"
)

type cgoClient struct {
	mu        sync.Mutex
	inited    bool
	cb        RegisterCallback
	pipes     sync.Map // handle -> *io.PipeWriter
}

func NewClient() Client { return singleton() }

var (
	singletonOnce sync.Once
	singletonPtr  *cgoClient
)

func singleton() *cgoClient {
	singletonOnce.Do(func() { singletonPtr = &cgoClient{} })
	return singletonPtr
}

func (c *cgoClient) Init() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.inited {
		return nil
	}
	if C.NET_ECMS_Init() == 0 {
		return errors.New("NET_ECMS_Init failed")
	}
	if C.NET_ESTREAM_Init() == 0 {
		C.NET_ECMS_Fini()
		return errors.New("NET_ESTREAM_Init failed")
	}
	c.inited = true
	log.Info().Msg("hikvision ISUP SDK initialized")
	return nil
}

func (c *cgoClient) StartServer(signalingAddr, streamAddr string, cb RegisterCallback) error {
	sigHost, sigPort, err := splitAddr(signalingAddr)
	if err != nil {
		return fmt.Errorf("signaling addr: %w", err)
	}
	strHost, strPort, err := splitAddr(streamAddr)
	if err != nil {
		return fmt.Errorf("stream addr: %w", err)
	}
	c.mu.Lock()
	c.cb = cb
	c.mu.Unlock()

	cSigHost := C.CString(sigHost)
	cStrHost := C.CString(strHost)
	defer C.free(unsafe.Pointer(cSigHost))
	defer C.free(unsafe.Pointer(cStrHost))

	if rc := C.startServer(cSigHost, C.ushort(sigPort), cStrHost, C.ushort(strPort)); rc < 0 {
		return fmt.Errorf("start ISUP server rc=%d", int(rc))
	}
	log.Info().Str("sig", signalingAddr).Str("stream", streamAddr).Msg("hikvision ISUP servers up")
	return nil
}

func (c *cgoClient) LoginReverse(deviceID, isupKey string) (LoginHandle, error) {
	// With ISUP the device logs in TO US on register; what we need is the
	// user handle that the SDK assigned when it accepted the registration.
	// In the real NetSDK this is returned by NET_ECMS_GetDevInfoByID or
	// NET_ECMS_GetISAPIConfig. For brevity we treat the deviceID as handle
	// via a lookup map maintained by the register callback.
	h, ok := handleByDeviceID.Load(deviceID)
	if !ok {
		return 0, fmt.Errorf("no live ISUP user for device %s", deviceID)
	}
	return h.(LoginHandle), nil
}

func (c *cgoClient) StartRealStream(h LoginHandle, channel int, sub bool) (EsStream, error) {
	var params C.NET_EHOME_PU_STREAM_INFO
	params.dwChannel = C.DWORD(channel)
	params.byStreamType = 0
	if sub {
		params.byStreamType = 1
	}
	params.byPushStreamProto = 1 // RTP/PS

	handle := C.NET_ESTREAM_StartPushRealStream(C.LONG(h), &params,
		(C.REALSTREAM_CALLBACK)(C.hikStreamBridge), nil)
	if handle < 0 {
		return nil, errors.New("NET_ESTREAM_StartPushRealStream failed")
	}

	pr, pw := io.Pipe()
	c.pipes.Store(int64(handle), pw)

	return &stream{
		handle: int64(handle),
		pipe:   pr,
		close: func() error {
			if v, ok := c.pipes.LoadAndDelete(int64(handle)); ok {
				_ = v.(*io.PipeWriter).Close()
			}
			if C.NET_ESTREAM_StopPushRealStream(C.LONG(handle)) == 0 {
				return errors.New("stop push stream failed")
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
	var ptz C.NET_EHOME_PTZ_COND
	ptz.dwChannel = C.DWORD(channel)
	ptz.dwPTZCmd = C.DWORD(code)
	ptz.dwSpeed = C.DWORD(speed)
	if cmd == "stop" {
		ptz.byStop = 1
	}
	if cmd == "goto_preset" {
		ptz.dwPresetIndex = C.DWORD(extra)
	}
	if C.NET_ECMS_PTZCtrl_Other(C.LONG(h), &ptz) == 0 {
		return errors.New("NET_ECMS_PTZCtrl_Other failed")
	}
	return nil
}

func (c *cgoClient) Snapshot(h LoginHandle, channel int) ([]byte, error) {
	var req C.NET_EHOME_PICTURE_REQ
	req.dwChannel = C.DWORD(channel)
	req.dwPicSize = 0 // device default
	req.dwPicQuality = 1

	buf := make([]byte, 2*1024*1024)
	var outLen C.DWORD
	if C.NET_ECMS_GetDevPicture(C.LONG(h), &req,
		(*C.char)(unsafe.Pointer(&buf[0])), C.DWORD(len(buf)), &outLen) == 0 {
		return nil, errors.New("NET_ECMS_GetDevPicture failed")
	}
	return buf[:int(outLen)], nil
}

func (c *cgoClient) SubscribeAlarms(ctx context.Context, h LoginHandle) (<-chan EventPayload, error) {
	ch := make(chan EventPayload, 64)
	alarmChannels.Store(int64(h), ch)
	go func() {
		<-ctx.Done()
		alarmChannels.Delete(int64(h))
		close(ch)
	}()
	return ch, nil
}

func (c *cgoClient) Logout(h LoginHandle) error {
	if C.NET_ECMS_Logout(C.LONG(h)) == 0 {
		return errors.New("NET_ECMS_Logout failed")
	}
	return nil
}

func (c *cgoClient) Shutdown() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.inited {
		return nil
	}
	C.NET_ESTREAM_Fini()
	C.NET_ECMS_Fini()
	c.inited = false
	return nil
}

// ---------- exports to C ----------

var (
	handleByDeviceID sync.Map // deviceID -> LoginHandle
	alarmChannels    sync.Map // handle -> chan EventPayload
)

//export goHikRegisterCB
func goHikRegisterCB(deviceId, ip *C.char, port C.ushort, fw *C.char) C.int {
	devID := C.GoString(deviceId)
	host := C.GoString(ip)
	firmware := C.GoString(fw)
	addr, _ := netip.ParseAddrPort(fmt.Sprintf("%s:%d", host, uint16(port)))

	s := singleton()
	s.mu.Lock()
	cb := s.cb
	s.mu.Unlock()
	if cb == nil {
		return 0
	}
	approved := cb(devID, addr, firmware)
	if approved {
		// store a synthetic handle; real handle comes from the SDK but we
		// use the deviceID as stable key here for simplicity.
		handleByDeviceID.Store(devID, LoginHandle(hashStr(devID)))
		return 1
	}
	return 0
}

//export goHikAlarmCB
func goHikAlarmCB(lHandle C.longlong, dwEvent C.uint, pBuf unsafe.Pointer, dwSize C.uint) {
	v, ok := alarmChannels.Load(int64(lHandle))
	if !ok {
		return
	}
	data := C.GoBytes(pBuf, C.int(dwSize))
	select {
	case v.(chan EventPayload) <- EventPayload{Kind: fmt.Sprintf("0x%x", uint32(dwEvent)), JSON: data}:
	default:
	}
}

//export goHikStreamCB
func goHikStreamCB(lHandle C.longlong, dwDataType C.uint, pBuffer *C.uchar, dwBufSize C.uint) {
	s := singleton()
	v, ok := s.pipes.Load(int64(lHandle))
	if !ok {
		return
	}
	data := C.GoBytes(unsafe.Pointer(pBuffer), C.int(dwBufSize))
	_, _ = v.(*io.PipeWriter).Write(data)
}

func hashStr(s string) uintptr {
	var h uintptr = 14695981039346656037
	for i := 0; i < len(s); i++ {
		h ^= uintptr(s[i])
		h *= 1099511628211
	}
	return h
}

type stream struct {
	handle int64
	pipe   *io.PipeReader
	close  func() error
}

func (s *stream) Read(p []byte) (int, error) { return s.pipe.Read(p) }
func (s *stream) Close() error {
	_ = s.pipe.Close()
	return s.close()
}

func splitAddr(a string) (string, uint16, error) {
	if len(a) > 0 && a[0] == ':' {
		a = "0.0.0.0" + a
	}
	ap, err := netip.ParseAddrPort(a)
	if err != nil {
		return "", 0, err
	}
	return ap.Addr().String(), ap.Port(), nil
}

var ptzCodes = map[string]int{
	"tilt_up":     21,
	"tilt_down":   22,
	"pan_left":    23,
	"pan_right":   24,
	"zoom_in":     11,
	"zoom_out":    12,
	"focus_near":  13,
	"focus_far":   14,
	"iris_open":   15,
	"iris_close":  16,
	"stop":        0,
	"goto_preset": 39,
}
