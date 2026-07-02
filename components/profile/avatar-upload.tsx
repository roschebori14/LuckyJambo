"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2, AlertCircle } from "lucide-react";
import { AvatarService } from "@/lib/profile/avatar-service";

export default function AvatarUpload({
  userId,
  initialAvatarUrl,
  username,
}: {
  userId: string;
  initialAvatarUrl: string | null;
  username: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Always clear the input value so picking the same file again
    // (e.g. after fixing an error) still fires onChange.
    e.target.value = "";
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const newUrl = await AvatarService.upload(userId, file);
      setAvatarUrl(newUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — please try again");
    } finally {
      setUploading(false);
    }
  }

  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-lg font-black text-white transition-transform active:scale-95 disabled:opacity-70"
        style={{
          background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)",
          border: "2px solid rgba(255,255,255,0.25)",
        }}
        aria-label="Change profile picture"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={username}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          initials
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? (
            <Loader2 size={18} className="animate-spin text-white" />
          ) : (
            <Camera size={18} className="text-white" />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--lj-danger)" }}>
          <AlertCircle size={12} className="shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
