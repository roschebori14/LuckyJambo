import { createClient } from "@/lib/supabase/client";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB, matches the bucket's file_size_limit
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class AvatarService {
  /** Validates the picked file before it ever touches the network. */
  static validate(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Please choose a JPG, PNG, or WEBP image";
    }
    if (file.size > MAX_FILE_BYTES) {
      return "Image must be smaller than 5MB";
    }
    return null;
  }

  /** Uploads to the user's own folder in the "avatars" bucket (RLS
   *  only allows writes under `${userId}/...`), always as a fixed
   *  `avatar.<ext>` filename so re-uploads overwrite in place instead
   *  of accumulating orphaned files. Returns a cache-busted public URL
   *  so the new image shows immediately instead of the browser
   *  serving the old cached one from the same path. */
  static async upload(userId: string, file: File): Promise<string> {
    const validationError = this.validate(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const supabase = createClient();
    const ext = EXT_BY_TYPE[file.type];
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: cacheBustedUrl })
      .eq("id", userId);

    if (updateError) {
      throw updateError;
    }

    return cacheBustedUrl;
  }
}
