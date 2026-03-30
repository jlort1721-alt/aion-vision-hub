/**
 * WebRTC SIP Phone Hook — Connects to Asterisk via SIP.js
 *
 * Extension 099 (Central AION) is always-on via WebRTC.
 * All 22 sites + intercoms + Twilio inbound ring here.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { UserAgent, Registerer, Inviter, Invitation, SessionState } from 'sip.js';
import type { Session } from 'sip.js';

const SIP_CONFIG = {
  wsServer: `wss://${window.location.host}/ws-phone/`,
  sipUri: 'sip:099@aionseg.co',
  authUser: '099',
  authPassword: 'C3ntr4l.A10N.2026!',
  displayName: 'Central AION',
};

export type PhoneStatus = 'disconnected' | 'connecting' | 'registered' | 'error';
export type CallStatus = 'idle' | 'dialing' | 'ringing' | 'in-call' | 'on-hold';

interface IncomingCall {
  id: string;
  callerName: string;
  callerNumber: string;
  invitation: Invitation;
}

export function useSipPhone() {
  const [phoneStatus, setPhoneStatus] = useState<PhoneStatus>('disconnected');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [currentNumber, setCurrentNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const uaRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create hidden audio element for remote audio
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = document.createElement('audio');
      audio.id = 'sip-remote-audio';
      audio.autoplay = true;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
    }
    return () => {
      if (remoteAudioRef.current) {
        document.body.removeChild(remoteAudioRef.current);
        remoteAudioRef.current = null;
      }
    };
  }, []);

  // Attach media to audio element when session has tracks
  const attachMedia = useCallback((session: Session) => {
    const pc = (session as unknown as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } })
      .sessionDescriptionHandler?.peerConnection;
    if (!pc || !remoteAudioRef.current) return;

    const remoteStream = new MediaStream();
    pc.getReceivers().forEach((receiver) => {
      if (receiver.track) remoteStream.addTrack(receiver.track);
    });
    remoteAudioRef.current.srcObject = remoteStream;
    remoteAudioRef.current.play().catch(() => { /* autoplay policy */ });
  }, []);

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    setCallDuration(0);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // Setup session event handlers
  const setupSession = useCallback((session: Session) => {
    sessionRef.current = session;

    session.stateChange.addListener((state: SessionState) => {
      switch (state) {
        case SessionState.Establishing:
          setCallStatus('dialing');
          break;
        case SessionState.Established:
          setCallStatus('in-call');
          attachMedia(session);
          startDurationTimer();
          break;
        case SessionState.Terminated:
          setCallStatus('idle');
          setCurrentNumber('');
          setIncomingCall(null);
          stopDurationTimer();
          sessionRef.current = null;
          break;
      }
    });
  }, [attachMedia, startDurationTimer, stopDurationTimer]);

  // Connect and register with Asterisk
  const connect = useCallback(async () => {
    if (uaRef.current) return;

    try {
      setPhoneStatus('connecting');
      setError(null);

      const ua = new UserAgent({
        uri: UserAgent.makeURI(SIP_CONFIG.sipUri)!,
        transportOptions: {
          server: SIP_CONFIG.wsServer,
        },
        authorizationUsername: SIP_CONFIG.authUser,
        authorizationPassword: SIP_CONFIG.authPassword,
        displayName: SIP_CONFIG.displayName,
        logLevel: 'warn',
        sessionDescriptionHandlerFactoryOptions: {
          peerConnectionConfiguration: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          },
        },
      });

      // Handle incoming calls
      ua.delegate = {
        onInvite: (invitation: Invitation) => {
          const caller = invitation.remoteIdentity;
          const callerName = caller.displayName || '';
          const callerNumber = caller.uri.user || '';

          setIncomingCall({
            id: invitation.id,
            callerName,
            callerNumber,
            invitation,
          });
          setCallStatus('ringing');
        },
      };

      await ua.start();
      uaRef.current = ua;

      // Register
      const registerer = new Registerer(ua, { expires: 300 });
      registererRef.current = registerer;

      registerer.stateChange.addListener((state) => {
        if (state === 'Registered') {
          setPhoneStatus('registered');
        } else if (state === 'Unregistered') {
          setPhoneStatus('disconnected');
        }
      });

      await registerer.register();
    } catch (err) {
      setError((err as Error).message);
      setPhoneStatus('error');
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      if (registererRef.current) {
        await registererRef.current.unregister();
        registererRef.current = null;
      }
      if (uaRef.current) {
        await uaRef.current.stop();
        uaRef.current = null;
      }
    } catch { /* ignore */ }
    setPhoneStatus('disconnected');
    setCallStatus('idle');
  }, []);

  // Make a call
  const call = useCallback(async (number: string) => {
    if (!uaRef.current || phoneStatus !== 'registered') {
      setError('Telefono no registrado');
      return;
    }

    const target = UserAgent.makeURI(`sip:${number}@aionseg.co`);
    if (!target) {
      setError('Numero invalido');
      return;
    }

    setCurrentNumber(number);
    setCallStatus('dialing');

    const inviter = new Inviter(uaRef.current, target, {
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
      },
    });

    setupSession(inviter);

    try {
      await inviter.invite();
    } catch (err) {
      setCallStatus('idle');
      setError((err as Error).message);
    }
  }, [phoneStatus, setupSession]);

  // Answer incoming call
  const answer = useCallback(async () => {
    if (!incomingCall) return;

    setupSession(incomingCall.invitation);
    setCurrentNumber(incomingCall.callerNumber);

    try {
      await incomingCall.invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });
    } catch (err) {
      setError((err as Error).message);
      setCallStatus('idle');
    }
  }, [incomingCall, setupSession]);

  // Reject incoming call
  const reject = useCallback(async () => {
    if (!incomingCall) return;
    try {
      await incomingCall.invitation.reject();
    } catch { /* ignore */ }
    setIncomingCall(null);
    setCallStatus('idle');
  }, [incomingCall]);

  // Hang up current call
  const hangup = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    try {
      switch (session.state) {
        case SessionState.Initial:
        case SessionState.Establishing:
          if (session instanceof Inviter) {
            await session.cancel();
          } else if (session instanceof Invitation) {
            await session.reject();
          }
          break;
        case SessionState.Established:
          await session.bye();
          break;
      }
    } catch { /* ignore */ }

    setCallStatus('idle');
    setCurrentNumber('');
    stopDurationTimer();
    sessionRef.current = null;
  }, [stopDurationTimer]);

  // Send DTMF
  const sendDtmf = useCallback((digit: string) => {
    const session = sessionRef.current;
    if (!session || session.state !== SessionState.Established) return;

    try {
      const body = { contentDisposition: 'render', contentType: 'application/dtmf-relay', content: `Signal=${digit}\r\nDuration=100\r\n` };
      session.info({ requestOptions: { body } });
    } catch { /* ignore */ }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => { disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    phoneStatus,
    callStatus,
    callDuration,
    currentNumber,
    incomingCall,
    error,
    connect,
    disconnect,
    call,
    answer,
    reject,
    hangup,
    sendDtmf,
  };
}
