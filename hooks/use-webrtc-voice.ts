"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type VoiceStatus =
  | "idle" // never enabled
  | "waiting" // mic on, in the signaling channel, opponent not there yet
  | "connecting" // both present, negotiating the WebRTC connection
  | "connected" // audio flowing
  | "peer-left" // was connected, opponent disconnected/left
  | "failed"; // getUserMedia denied, or the connection couldn't establish

// Public STUN only (no TURN server configured). STUN is enough for
// most home/office networks where at least one side has a directly
// reachable-ish NAT mapping, but it will NOT punch through symmetric
// / carrier-grade NAT (common on some mobile networks) - that shows up
// as `status: "failed"` after the negotiation timeout below. Wiring a
// TURN provider (Twilio, Xirsys, self-hosted coturn, etc.) into this
// `iceServers` array is the fix if that turns out to be common for
// this player base; left as plain STUN here since no TURN credentials
// exist yet.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const NEGOTIATION_TIMEOUT_MS = 15000;
const SUBSCRIBE_TIMEOUT_MS = 10000;
const ICE_RESTART_GRACE_MS = 3000;

interface SignalPayload {
  from: string;
  kind: "offer" | "answer" | "ice-candidate" | "bye";
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

// "Glitchy/crackling" audio on an already-connected call is almost
// never a broken connection - it's Opus running at its default
// low/variable bitrate with no forward error correction, so any
// packet loss (routine on mobile 3G/4G) shows up as audible
// dropouts. This nudges the SDP to a mono, FEC-enabled, ~32kbps
// stream, which is plenty for voice and far more resilient to loss.
// Safe no-op if Opus isn't present for some reason.
function tuneOpusSdp(sdp: string): string {
  const rtpmapMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
  if (!rtpmapMatch) return sdp;
  const payloadType = rtpmapMatch[1];
  const params = "minptime=10;useinbandfec=1;stereo=0;maxaveragebitrate=32000";

  const fmtpRegex = new RegExp(`a=fmtp:${payloadType} (.*?)\r?\n`);
  if (fmtpRegex.test(sdp)) {
    return sdp.replace(fmtpRegex, (_match, existing: string) => {
      // Keep whatever the browser already set (e.g. useinbandfec if
      // it's already there) and layer ours on top without duplicating.
      const existingParams = existing.trim();
      const merged = existingParams
        ? `${existingParams};${params}`
        : params;
      return `a=fmtp:${payloadType} ${merged}\r\n`;
    });
  }

  // No fmtp line for Opus yet - add one right after its rtpmap line.
  return sdp.replace(
    /a=rtpmap:(\d+) opus\/48000\r?\n/i,
    (match) => `${match}a=fmtp:${payloadType} ${params}\r\n`
  );
}

/**
 * Peer-to-peer voice chat for the two participants in a match, signaled
 * over a per-match Supabase Realtime broadcast channel
 * (`voice:{matchId}`) rather than a dedicated signaling server - audio
 * itself flows directly between the two browsers via WebRTC once
 * connected, Supabase is only ever used to exchange the SDP offer/
 * answer and ICE candidates.
 *
 * Scoped to exactly two peers (standard 1:1 mesh). Ludo (3-4 players)
 * deliberately doesn't use this hook - an N-way mesh or SFU is a
 * different, bigger piece of work than what was asked for here.
 *
 * Nothing is grabbed or connected until `enableMic()` is called - the
 * browser mic permission prompt should only ever appear after an
 * explicit user action, never automatically on match load.
 */
export function useWebRTCVoice(matchId: string, userId: string) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [micOn, setMicOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peerMuted, setPeerMuted] = useState(false);
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const negotiationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const makingOfferRef = useRef(false);
  // Only the side that made the original offer drives ICE restarts,
  // so both browsers don't race to restart at once.
  const isInitiatorRef = useRef(false);

  const clearNegotiationTimer = () => {
    if (negotiationTimerRef.current) {
      clearTimeout(negotiationTimerRef.current);
      negotiationTimerRef.current = null;
    }
  };

  const clearSubscribeTimeout = () => {
    if (subscribeTimeoutRef.current) {
      clearTimeout(subscribeTimeoutRef.current);
      subscribeTimeoutRef.current = null;
    }
  };

  const clearIceRestartTimer = () => {
    if (iceRestartTimerRef.current) {
      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
    }
  };

  const send = useCallback((payload: SignalPayload) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload });
  }, []);

  // Holds the latest makeOffer so createPeerConnection's ICE-restart
  // handler can call it without a circular useCallback dependency
  // (makeOffer itself depends on createPeerConnection). Reassigned on
  // every render, which is cheap and always keeps it current.
  const makeOfferRef = useRef<((iceRestart?: boolean) => Promise<void>) | null>(null);

  const teardownPeerConnection = useCallback(() => {
    clearNegotiationTimer();
    clearIceRestartTimer();
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    peerIdRef.current = null;
    isInitiatorRef.current = false;
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ from: userId, kind: "ice-candidate", data: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
      }
      // Trade a bit of latency for smoothness against packet loss -
      // but keep it modest. Anything past ~30ms of round-trip leakage
      // from your own speaker into your own mic stops fusing with
      // your voice and starts being heard as a distinct echo, and a
      // buffer this large also risks audibly overlapping with fresh
      // audio (perceived as "chopping"). 150ms is enough to smooth
      // routine mobile jitter without pushing echo into audible range.
      const receiver = event.receiver as RTCRtpReceiver & { playoutDelayHint?: number };
      if (receiver && "playoutDelayHint" in receiver) {
        receiver.playoutDelayHint = 0.15;
      }
      clearNegotiationTimer();
      clearIceRestartTimer();
      setStatus("connected");
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        setStatus("failed");
        setError("Voice connection failed - this can happen on some mobile networks.");
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        setStatus((prev) => (prev === "connected" ? "peer-left" : prev));
      }
    };

    pc.oniceconnectionstatechange = () => {
      // "disconnected" is common and often transient on mobile
      // networks (a few seconds of bad signal, a tower handoff) - it
      // is NOT the same as the peer actually leaving. Give it a
      // moment to self-recover before trying an ICE restart, and only
      // from the side that originally initiated the call so both
      // browsers don't restart at once.
      if (pc.iceConnectionState === "disconnected") {
        clearIceRestartTimer();
        iceRestartTimerRef.current = setTimeout(() => {
          const stillBad =
            pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed";
          if (stillBad && isInitiatorRef.current) {
            void makeOfferRef.current?.(true);
          }
        }, ICE_RESTART_GRACE_MS);
      } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        clearIceRestartTimer();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [send, userId]);

  const startNegotiationTimeout = useCallback(() => {
    clearNegotiationTimer();
    negotiationTimerRef.current = setTimeout(() => {
      if (pcRef.current && pcRef.current.connectionState !== "connected") {
        setStatus("failed");
        setError("Couldn't establish a voice connection. Try again, or check your network.");
      }
    }, NEGOTIATION_TIMEOUT_MS);
  }, []);

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (payload.from === userId) return; // ignore our own broadcasts, if ever echoed

      if (payload.kind === "bye") {
        teardownPeerConnection();
        setStatus("peer-left");
        setPeerMuted(false);
        return;
      }

      // First message from this peer - they're the one we negotiate
      // with (only two participants ever join this channel).
      if (!peerIdRef.current) peerIdRef.current = payload.from;
      if (payload.from !== peerIdRef.current) return;

      const pc = pcRef.current ?? createPeerConnection();

      if (payload.kind === "offer" && payload.data) {
        setStatus("connecting");
        startNegotiationTimeout();
        await pc.setRemoteDescription(payload.data as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        answer.sdp = tuneOpusSdp(answer.sdp ?? "");
        await pc.setLocalDescription(answer);
        send({ from: userId, kind: "answer", data: answer });
      } else if (payload.kind === "answer" && payload.data) {
        await pc.setRemoteDescription(payload.data as RTCSessionDescriptionInit);
      } else if (payload.kind === "ice-candidate" && payload.data) {
        try {
          await pc.addIceCandidate(payload.data as RTCIceCandidateInit);
        } catch {
          /* candidate can arrive before the remote description is set
             in rare orderings - safe to drop, more candidates follow */
        }
      }
    },
    [userId, createPeerConnection, send, startNegotiationTimeout, teardownPeerConnection]
  );

  const makeOffer = useCallback(async (iceRestart = false) => {
    if (makingOfferRef.current) return;
    makingOfferRef.current = true;
    try {
      const pc = pcRef.current ?? createPeerConnection();
      isInitiatorRef.current = true;
      setStatus("connecting");
      startNegotiationTimeout();
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      offer.sdp = tuneOpusSdp(offer.sdp ?? "");
      await pc.setLocalDescription(offer);
      send({ from: userId, kind: "offer", data: offer });
    } finally {
      makingOfferRef.current = false;
    }
  }, [createPeerConnection, send, startNegotiationTimeout, userId]);
  makeOfferRef.current = makeOffer;

  const enableMic = useCallback(async () => {
    setError("");
    // Safe to call again after a failure ("Retry") - clear out
    // whatever's left of the previous attempt first, otherwise a
    // retry would leak the old channel subscription and reuse a dead
    // RTCPeerConnection stuck in "failed".
    clearSubscribeTimeout();
    teardownPeerConnection();
    if (channelRef.current) {
      const supabase = createClient();
      channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    peerIdRef.current = null;

    try {
      // Explicit constraints instead of `audio: true` - default
      // behavior for these varies across mobile Chrome/Safari/WebView
      // builds, and an unprocessed capture is a big part of "unclear"
      // audio: no echo cancellation lets the peer's own voice bleed
      // back in through the speaker, no noise suppression lets ambient
      // noise through, and letting the browser pick channel
      // count/sample rate sometimes lands on something Opus resamples
      // badly. Pinning these gives a clean, consistent mono 48kHz feed.
      //
      // The googX fields are non-standard Chrome/Chromium extras -
      // ignored harmlessly by browsers that don't recognize them, but
      // on Chromium (the large majority of this player base) they push
      // the AEC specifically harder against speaker-to-mic leakage,
      // which is what shows up as "hearing your own voice echoed
      // back". Standard `echoCancellation: true` alone is a good
      // baseline but doesn't fully eliminate leakage on phone
      // speakers/cheap mics - these extras close most of that gap.
      // No echo canceler (browser or otherwise) can remove leakage
      // from a DIFFERENT physical device's speaker into your mic -
      // that's a room-acoustics problem, not a software one, and is
      // the other common cause of this if two people are testing near
      // each other without headphones.
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...audioConstraints,
          ...({
            googEchoCancellation: true,
            googEchoCancellation2: true,
            googAutoGainControl: true,
            googAutoGainControl2: true,
            googNoiseSuppression: true,
            googNoiseSuppression2: true,
            googHighpassFilter: true,
            googTypingNoiseDetection: true,
          } as MediaTrackConstraints),
        },
        video: false,
      });
      localStreamRef.current = stream;
      setMicOn(true);
      setMuted(false);
      setPeerMuted(false);
      setStatus("waiting");

      const supabase = createClient();
      const channel = supabase.channel(`voice:${matchId}`, {
        config: { private: true, presence: { key: userId } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "signal" }, ({ payload }) => handleSignal(payload as SignalPayload))
        .on("broadcast", { event: "mute-state" }, ({ payload }) => {
          if (payload?.from !== userId) setPeerMuted(!!payload?.muted);
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const others = Object.keys(state).filter((id) => id !== userId);
          // Lowest-id peer initiates the offer once both sides are
          // present, so both browsers don't race to call each other
          // simultaneously (WebRTC "glare").
          if (others.length > 0 && !pcRef.current && userId < others[0]) {
            peerIdRef.current = others[0];
            void makeOffer();
          }
        })
        .subscribe(async (subscribeStatus, err) => {
          if (subscribeStatus === "SUBSCRIBED") {
            clearSubscribeTimeout();
            await channel.track({ user_id: userId, online_at: new Date().toISOString() });
          } else if (subscribeStatus === "CHANNEL_ERROR" || subscribeStatus === "TIMED_OUT") {
            // Most likely cause once realtime authorization is wired up
            // (see migration adding RLS on realtime.messages): the
            // caller isn't actually a participant of this match and
            // was refused. Whatever the cause, don't leave the user
            // stuck on "waiting" forever with a live mic and no
            // feedback.
            clearSubscribeTimeout();
            setStatus("failed");
            setError(err?.message || "Couldn't connect to voice chat. You may not have permission to join this match's voice channel.");
            localStreamRef.current?.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
          }
        });

      subscribeTimeoutRef.current = setTimeout(() => {
        setStatus((prev) => {
          if (prev !== "waiting") return prev;
          setError("Voice channel didn't respond in time. Please try again.");
          localStreamRef.current?.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
          return "failed";
        });
      }, SUBSCRIBE_TIMEOUT_MS);
    } catch (err) {
      setStatus("failed");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setError("Microphone permission was denied. Check your browser's site settings.");
      } else if (name === "NotFoundError") {
        setError("No microphone was found on this device.");
      } else if (name === "NotReadableError") {
        setError("Your microphone is being used by another app.");
      } else {
        setError("Microphone access was denied or unavailable.");
      }
    }
  }, [matchId, userId, handleSignal, makeOffer]);

  const disableMic = useCallback(() => {
    send({ from: userId, kind: "bye" });
    clearSubscribeTimeout();
    clearIceRestartTimer();
    teardownPeerConnection();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (channelRef.current) {
      const supabase = createClient();
      channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setMicOn(false);
    setMuted(false);
    setPeerMuted(false);
    setStatus("idle");
  }, [send, userId, teardownPeerConnection]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      channelRef.current?.send({
        type: "broadcast",
        event: "mute-state",
        payload: { from: userId, muted: next },
      });
      return next;
    });
  }, [userId]);

  // Cleanup on match exit / component unmount - never leave a mic
  // stream open or a peer connection dangling once the player
  // navigates away from the match.
  useEffect(() => {
    return () => {
      clearSubscribeTimeout();
      teardownPeerConnection();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      if (channelRef.current) {
        const supabase = createClient();
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, micOn, muted, peerMuted, error, audioRef, enableMic, disableMic, toggleMute };
}
