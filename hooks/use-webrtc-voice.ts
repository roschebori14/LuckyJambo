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

interface SignalPayload {
  from: string;
  kind: "offer" | "answer" | "ice-candidate" | "bye";
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
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
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const negotiationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const makingOfferRef = useRef(false);

  const clearNegotiationTimer = () => {
    if (negotiationTimerRef.current) {
      clearTimeout(negotiationTimerRef.current);
      negotiationTimerRef.current = null;
    }
  };

  const send = useCallback((payload: SignalPayload) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload });
  }, []);

  const teardownPeerConnection = useCallback(() => {
    clearNegotiationTimer();
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    peerIdRef.current = null;
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
      clearNegotiationTimer();
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

  const makeOffer = useCallback(async () => {
    if (makingOfferRef.current) return;
    makingOfferRef.current = true;
    try {
      const pc = pcRef.current ?? createPeerConnection();
      setStatus("connecting");
      startNegotiationTimeout();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ from: userId, kind: "offer", data: offer });
    } finally {
      makingOfferRef.current = false;
    }
  }, [createPeerConnection, send, startNegotiationTimeout, userId]);

  const enableMic = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setMicOn(true);
      setMuted(false);
      setStatus("waiting");

      const supabase = createClient();
      const channel = supabase.channel(`voice:${matchId}`, {
        config: { presence: { key: userId } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "signal" }, ({ payload }) => handleSignal(payload as SignalPayload))
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
        .subscribe(async (subscribeStatus) => {
          if (subscribeStatus === "SUBSCRIBED") {
            await channel.track({ user_id: userId, online_at: new Date().toISOString() });
          }
        });
    } catch {
      setStatus("failed");
      setError("Microphone access was denied or unavailable.");
    }
  }, [matchId, userId, handleSignal, makeOffer]);

  const disableMic = useCallback(() => {
    send({ from: userId, kind: "bye" });
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
    setStatus("idle");
  }, [send, userId, teardownPeerConnection]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  // Cleanup on match exit / component unmount - never leave a mic
  // stream open or a peer connection dangling once the player
  // navigates away from the match.
  useEffect(() => {
    return () => {
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

  return { status, micOn, muted, error, audioRef, enableMic, disableMic, toggleMute };
}
