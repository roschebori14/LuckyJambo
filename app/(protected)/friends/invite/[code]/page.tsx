import { redirect } from "next/navigation";
import Link from "next/link";
import { UserX } from "lucide-react";
import { getUser } from "@/lib/auth/get-user";
import { FriendService } from "@/lib/friends/friend-service";
import InviteAcceptCard from "@/components/friends/invite-accept-card";

export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/friends/invite/${code}`)}`);
  }

  const owner = await FriendService.resolveInviteCode(code);

  if (!owner) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <UserX size={40} className="mx-auto text-[var(--lj-muted)]" />
        <h1 className="text-xl font-bold text-white">Invalid invite link</h1>
        <p className="text-sm text-[var(--lj-muted)]">
          This invite link doesn&apos;t exist or has expired.
        </p>
        <Link href="/friends" className="lj-btn-primary inline-flex">
          Go to Friends
        </Link>
      </div>
    );
  }

  if (owner.id === user.id) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <h1 className="text-xl font-bold text-white">This is your own invite link</h1>
        <p className="text-sm text-[var(--lj-muted)]">
          Share it with someone else so they can add you as a friend.
        </p>
        <Link href="/friends" className="lj-btn-primary inline-flex">
          Go to Friends
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <InviteAcceptCard code={code} owner={owner} />
    </div>
  );
}
