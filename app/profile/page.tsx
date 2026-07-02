import { UserCircle } from "lucide-react";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import AvatarUpload from "@/components/profile/avatar-upload";
import ProfileForm from "@/components/profile/profile-form";

export default async function ProfilePage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, bio, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <UserCircle size={22} style={{ color: "var(--lj-cyan)" }} /> Profile
        </h1>
      </div>

      <div className="lj-card flex flex-col items-center gap-3 p-6">
        <AvatarUpload
          userId={user.id}
          initialAvatarUrl={profile?.avatar_url ?? null}
          username={profile?.username ?? user.email?.split("@")[0] ?? "Player"}
        />
        <p className="text-xs text-[var(--lj-muted)]">Tap the avatar to change your photo</p>
      </div>

      <div className="lj-card p-5">
        <ProfileForm
          userId={user.id}
          initialUsername={profile?.username ?? ""}
          initialFullName={profile?.full_name ?? ""}
          initialBio={profile?.bio ?? ""}
          email={user.email ?? ""}
        />
      </div>
    </div>
  );
}
