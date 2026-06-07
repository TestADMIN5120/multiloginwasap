// mobile/src/context/CallContext.js
// ---------------------------------------------------------------------------
// Owns everything about the currently-active call:
//   - Listens for incoming call:* socket events
//   - Drives RTCPeerConnection lifecycle (offer/answer/ICE)
//   - Exposes startCall/accept/decline/hangup to the UI
//
// Designed to live above the navigator so any screen can trigger a call
// and any screen can show the in-call UI / incoming-call sheet.
//
// In Expo Go (no native WebRTC) every public method returns a friendly
// "build the APK" Alert instead of crashing the bundler.
// ---------------------------------------------------------------------------

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import { useSocket } from './SocketContext';
import { useAccount } from './AccountContext';
import * as callApi from '../api/call.api';
import { getWebRTC, isWebRTCAvailable } from '../utils/webrtc';

const CallContext = createContext(null);

// activeCall shape:
//   {
//     id, conversationId, type ('audio'|'video'),
//     status ('ringing'|'connecting'|'connected'|'ended'),
//     role   ('caller'|'callee'),
//     peerAccountId,
//     peer:  { id, displayName, username, avatarUrl } | null,
//     startedAt, acceptedAt, endedAt, endedReason
//   }

export function CallProvider({ children }) {
  const { socket } = useSocket();
  const { activeAccount } = useAccount();

  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  // Buffer ICE candidates that arrive before setRemoteDescription completes.
  const pendingRemoteCandidatesRef = useRef([]);

  const webrtcAvailable = isWebRTCAvailable();

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function notAvailable() {
    Alert.alert(
      'Calls not available in Expo Go',
      'Audio / video calls use react-native-webrtc which is a native module ' +
        'that Expo Go cannot load.\n\n' +
        'Build the dev APK with:\n' +
        '  cd mobile\n' +
        '  eas build --profile preview --platform android\n\n' +
        'Install the resulting APK on your phone — calls then work end-to-end.'
    );
  }

  const teardownPeer = useCallback(() => {
    try {
      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      }
    } catch {}
    pcRef.current = null;

    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    localStreamRef.current = null;
    pendingRemoteCandidatesRef.current = [];

    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCameraOn(true);
  }, []);

  const fullTeardown = useCallback(() => {
    teardownPeer();
    setActiveCall(null);
    setIncomingCall(null);
  }, [teardownPeer]);

  // -------------------------------------------------------------------------
  // Build a peer connection bound to the active call.
  // -------------------------------------------------------------------------
  const buildPeer = useCallback(
    async (callId, peerAccountId, type) => {
      const webrtc = getWebRTC();
      if (!webrtc) throw new Error('webrtc-not-available');

      const { mediaDevices, RTCPeerConnection } = webrtc;

      const iceServers = await callApi.getIceServers().catch(() => [
        { urls: ['stun:stun.l.google.com:19302'] },
      ]);

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? { facingMode: 'user' } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection({ iceServers });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const incoming = event.streams && event.streams[0];
        if (incoming) setRemoteStream(incoming);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('call:ice-candidate', {
            callId,
            toAccountId: peerAccountId,
            payload: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          setActiveCall((cur) => (cur ? { ...cur, status: 'connected' } : cur));
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          // Let server-side hangup drive the actual teardown — but if we're
          // sure it's gone, end the call locally too.
          if (state === 'failed') {
            socket?.emit('call:end', { callId });
            fullTeardown();
          }
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [socket, fullTeardown]
  );

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  const startCall = useCallback(
    async (conversationId, type = 'audio', { peer } = {}) => {
      if (!webrtcAvailable) return notAvailable();
      if (!socket) {
        Alert.alert('Offline', 'You need a network connection to start a call.');
        return;
      }
      if (activeCall) {
        Alert.alert('Already in a call', 'End the current call first.');
        return;
      }

      // Optimistic local state — refined after server ack
      setActiveCall({
        id: null,
        conversationId,
        type,
        status: 'ringing',
        role: 'caller',
        peer: peer || null,
        peerAccountId: null,
        startedAt: new Date().toISOString(),
      });

      socket.emit('call:invite', { conversationId, type }, async (ack) => {
        if (!ack?.ok || !ack.call) {
          Alert.alert('Could not start call', ack?.error || 'Server refused the invite.');
          fullTeardown();
          return;
        }
        const call = ack.call;
        const peerAccountId = (call.calleeAccountIds || [])[0];

        try {
          await buildPeer(call.id, peerAccountId, type);
        } catch (err) {
          if (err.message === 'webrtc-not-available') notAvailable();
          else Alert.alert('Could not access mic / camera', String(err?.message || err));
          socket.emit('call:cancel', { callId: call.id });
          fullTeardown();
          return;
        }

        setActiveCall({
          id: call.id,
          conversationId,
          type,
          status: 'ringing',
          role: 'caller',
          peer: peer || null,
          peerAccountId,
          startedAt: call.startedAt || new Date().toISOString(),
        });
      });
    },
    [webrtcAvailable, socket, activeCall, buildPeer, fullTeardown]
  );

  const acceptIncoming = useCallback(async () => {
    if (!webrtcAvailable) return notAvailable();
    if (!incomingCall || !socket) return;

    const call = incomingCall;
    setIncomingCall(null);

    setActiveCall({
      id: call.id,
      conversationId: call.conversationId,
      type: call.type,
      status: 'connecting',
      role: 'callee',
      peer: call.peer || null,
      peerAccountId: call.callerAccountId,
      startedAt: call.startedAt,
    });

    try {
      await buildPeer(call.id, call.callerAccountId, call.type);
    } catch (err) {
      if (err.message === 'webrtc-not-available') notAvailable();
      else Alert.alert('Could not access mic / camera', String(err?.message || err));
      socket.emit('call:decline', { callId: call.id });
      fullTeardown();
      return;
    }

    socket.emit('call:accept', { callId: call.id });
  }, [webrtcAvailable, incomingCall, socket, buildPeer, fullTeardown]);

  const declineIncoming = useCallback(() => {
    if (!incomingCall || !socket) {
      setIncomingCall(null);
      return;
    }
    socket.emit('call:decline', { callId: incomingCall.id });
    setIncomingCall(null);
  }, [incomingCall, socket]);

  const hangup = useCallback(() => {
    if (!activeCall || !socket) {
      fullTeardown();
      return;
    }
    if (activeCall.role === 'caller' && activeCall.status === 'ringing') {
      socket.emit('call:cancel', { callId: activeCall.id });
    } else {
      socket.emit('call:end', { callId: activeCall.id });
    }
    fullTeardown();
  }, [activeCall, socket, fullTeardown]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !muted;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !cameraOn;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCameraOn(next);
  }, [cameraOn]);

  const switchCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      if (typeof t._switchCamera === 'function') t._switchCamera();
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((v) => !v);
    // Real audio routing requires react-native-incall-manager; this flag is
    // wired for when we add it. For now it's purely a UI toggle.
  }, []);

  // -------------------------------------------------------------------------
  // Socket signaling listeners
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!socket || !activeAccount) return undefined;

    const onRinging = (call) => {
      // If WE initiated this, we already updated state in startCall ack.
      if (call.callerAccountId === activeAccount.id) return;
      // Only first callee gets the popup (1:1 calls today).
      if (!(call.calleeAccountIds || []).includes(activeAccount.id)) return;
      // Don't replace an existing call/popup.
      if (activeCall || incomingCall) {
        // Auto-decline if busy.
        socket.emit('call:decline', { callId: call.id });
        return;
      }
      setIncomingCall(call);
    };

    const onAccepted = async (call) => {
      // Caller side: now create the offer.
      if (call.callerAccountId !== activeAccount.id) return;
      const pc = pcRef.current;
      if (!pc) return;

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: call.type === 'video',
        });
        await pc.setLocalDescription(offer);
        const peerAccountId = (call.calleeAccountIds || [])[0];
        socket.emit('call:offer', {
          callId: call.id,
          toAccountId: peerAccountId,
          payload: { type: offer.type, sdp: offer.sdp },
        });
        setActiveCall((cur) => (cur ? { ...cur, status: 'connecting' } : cur));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[call] createOffer failed', err);
        socket.emit('call:end', { callId: call.id });
        fullTeardown();
      }
    };

    const onOffer = async ({ callId, fromAccountId, payload }) => {
      // Callee side: incoming SDP offer
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const webrtc = getWebRTC();
        await pc.setRemoteDescription(new webrtc.RTCSessionDescription(payload));
        // Drain any candidates that arrived before remote desc was set.
        for (const c of pendingRemoteCandidatesRef.current) {
          try { await pc.addIceCandidate(new webrtc.RTCIceCandidate(c)); } catch {}
        }
        pendingRemoteCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:answer', {
          callId,
          toAccountId: fromAccountId,
          payload: { type: answer.type, sdp: answer.sdp },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[call] handle offer failed', err);
        socket.emit('call:end', { callId });
        fullTeardown();
      }
    };

    const onAnswer = async ({ payload }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const webrtc = getWebRTC();
        await pc.setRemoteDescription(new webrtc.RTCSessionDescription(payload));
        for (const c of pendingRemoteCandidatesRef.current) {
          try { await pc.addIceCandidate(new webrtc.RTCIceCandidate(c)); } catch {}
        }
        pendingRemoteCandidatesRef.current = [];
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[call] handle answer failed', err);
      }
    };

    const onIceCandidate = async ({ payload }) => {
      const pc = pcRef.current;
      if (!pc || !payload) return;
      try {
        const webrtc = getWebRTC();
        const candidate = new webrtc.RTCIceCandidate(payload);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(candidate);
        } else {
          pendingRemoteCandidatesRef.current.push(payload);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[call] addIceCandidate failed', err);
      }
    };

    const onEnded = (call) => {
      // Mirror server's lifecycle decision.
      if (incomingCall && call.id === incomingCall.id) setIncomingCall(null);
      if (activeCall && call.id === activeCall.id) {
        setActiveCall((cur) => (cur ? { ...cur, status: 'ended', endedReason: call.endedReason } : null));
      }
      teardownPeer();
      // Briefly keep the "ended" banner; clear after a short delay.
      setTimeout(() => {
        setActiveCall((cur) => (cur && cur.id === call.id ? null : cur));
      }, 1500);
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:accepted', onAccepted);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:accepted', onAccepted);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:ended', onEnded);
    };
    // We intentionally include activeCall/incomingCall so the closure sees
    // the latest state when the server emits during a ringing call.
  }, [socket, activeAccount?.id, activeCall, incomingCall, teardownPeer, fullTeardown]);

  // Tear down everything if the user signs out / switches account.
  useEffect(() => {
    return () => fullTeardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.id]);

  const value = useMemo(
    () => ({
      // state
      activeCall,
      incomingCall,
      localStream,
      remoteStream,
      muted,
      cameraOn,
      speakerOn,
      webrtcAvailable,
      // actions
      startCall,
      acceptIncoming,
      declineIncoming,
      hangup,
      toggleMute,
      toggleCamera,
      toggleSpeaker,
      switchCamera,
    }),
    [
      activeCall, incomingCall, localStream, remoteStream,
      muted, cameraOn, speakerOn, webrtcAvailable,
      startCall, acceptIncoming, declineIncoming, hangup,
      toggleMute, toggleCamera, toggleSpeaker, switchCamera,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside CallProvider');
  return ctx;
}

// Used by chat list / chat screen to know whether to dim the call buttons.
export function useCallAvailability() {
  const ctx = useContext(CallContext);
  return {
    available: !!ctx?.webrtcAvailable,
    platform: Platform.OS,
  };
}

