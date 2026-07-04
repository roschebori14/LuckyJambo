import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, ShieldCheck, Crown } from "lucide-react";
import { requireAuth } from "@/lib/auth/require-auth";
import { PublicProfileService } from "@/lib/profile/public-profile-service";
import { FriendService } from "@/lib/friends/friend-service";
import ProfileOnlineBadge from "@/components/profile/profile-online-badge";
import ProfileActions from "@/components/profile/profile-actions";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await requireAuth();

  const profile = await PublicProfileService.getByUsername(username);

  if (!profile) {
    notFound();
  }

  const isSelf = profile.id === user.id;
  const status = isSelf ? "self" : await FriendService.getFriendshipStatus(user.id, profile.id);

  const joined = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const winRate =
    profile.matches_played > 0 ? Math.round((profile.wins / profile.matches_played) * 100) : 0;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/friends"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--lj-muted)] hover:text-white"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="lj-card flex flex-col items-center gap-3 p-6 text-center">
        <div className="relative">
          <div
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-2xl font-black text-white"
            style={{ background: "linear-gradient(135deg, var(--lj-blue) 0%, var(--lj-cyan) 100%)" }}
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="h-full w-full object-cover"
              />
            ) : (
              profile.username.slice(0, 2).toUpperCase()
            )}
          </div>
          <ProfileOnlineBadge userId={profile.id} />
        </div>

        <div>
          <h1 className="flex items-center justify-center gap-1.5 text-xl font-black text-white">
            {profile.username}
            {profile.is_verified && (
              <ShieldCheck size={16} style={{ color: "var(--lj-cyan)" }} />
            )}
            {profile.role === "admin" && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                style={{ background: "var(--lj-blue)" }}
              >
                <Crown size={10} /> Admin
              </span>
            )}
          </h1>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-[var(--lj-muted)]">
            <Calendar size={12} /> Joined {joined}
          </p>
        </div>

        {profile.bio && (
          <p className="max-w-sm text-sm text-[var(--lj-muted)]">{profile.bio}</p>
        )}

        {isSelf ? (
          <Link href="/profile" className="lj-btn-primary inline-flex">
            Edit Your Profile
          </Link>
        ) : (
          <ProfileActions targetId={profile.id} username={profile.username} initialStatus={status} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Wins" value={profile.wins} />
        <StatCard label="Losses" value={profile.losses} />
        <StatCard label="Win Rate" value={`${winRate}%`} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="lj-card p-4 text-center">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--lj-muted)]">
        {label}
      </p>
    </div>
  );
}
