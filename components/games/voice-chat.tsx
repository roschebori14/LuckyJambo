"use client";

import { Mic, MicOff, PhoneOff, Radio, AlertCircle, Loader2 } from "lucide-react";
import { useWebRTCVoice } from "@/hooks/use-webrtc-voice";

interface VoiceChatProps {
  matchId: string;
  userId: string;
}

export default function VoiceChat({ matchId, userId }: VoiceChatProps) {
  const { status, micOn, muted, error, audioRef, enableMic, disableMic, toggleMute } =
    useWebRTCVoice(matchId, userId);

  return (
    <div className="rounded-2xl border border-[var(--lj-border)] bg-[var(--lj-card-2)] p-4 shadow-sm">
      {/* Remote audio - not visible, just plays whatever the peer sends */}
      <audio ref={audioRef} autoPlay playsInline />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <StatusDot status={status} />
          <span className="font-medium text-white">Voice Chat</span>
          <span className="text-xs text-[var(--lj-muted)]">{statusLabel(status)}</span>
        </div>

        <div className="flex items-center gap-2">
          {!micOn ? (
            <button
              onClick={enableMic}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700"
            >
              <Mic size={14} /> Enable Voice
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                disabled={status === "connecting" || status === "waiting"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition-colors disabled:opacity-40 ${
                  muted ? "bg-red-600 hover:bg-red-700" : "bg-white/10 hover:bg-white/20"
                }`}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <MicOff size={14} /> : <Mic size={14} />}
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                onClick={disableMic}
                className="flex items-center gap-1.5 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"
                title="End voice chat"
              >
                <PhoneOff size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "connecting" || status === "waiting") {
    return <Loader2 size={14} className="animate-spin text-yellow-400" />;
  }
  const color =
    status === "connected" ? "bg-green-400" :
    status === "failed" ? "bg-red-400" :
    status === "peer-left" ? "bg-orange-400" :
    "bg-[var(--lj-muted)]";
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === "connected" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "idle": return "Off";
    case "waiting": return "Waiting for opponent…";
    case "connecting": return "Connecting…";
    case "connected": return "Live";
    case "peer-left": return "Opponent left";
    case "failed": return "Connection failed";
    default: return "";
  }
}
