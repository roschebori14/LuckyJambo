"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSound } from "@/lib/sound/sound-manager";

/** Drop into Navbar (or anywhere) - toggles the whole app's sound effects. */
export default function SoundToggle() {
  const { muted, toggleMute } = useSound();

  return (
    <button
      onClick={toggleMute}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      aria-pressed={muted}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--lj-muted)] hover:bg-white/10 hover:text-white"
      title={muted ? "Sound off" : "Sound on"}
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}
