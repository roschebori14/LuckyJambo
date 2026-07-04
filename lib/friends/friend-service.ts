import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FriendshipStatus, PublicProfile } from "@/types/profile";

export class FriendService {
  /** Sends a friend request after checking for self-adds, existing
   *  friendships, and existing pending requests in either direction -
   *  the DB now has a unique index backing this too, but checking
   *  first lets us return a clear error instead of a raw constraint
   *  violation. */
  static async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new Error("You can't add yourself as a friend");
    }

    const supabase = await createClient();

    const { data: existingFriend } = await supabase
      .from("friends")
      .select("id")
      .eq("user_id", senderId)
      .eq("friend_id", receiverId)
      .maybeSingle();

    if (existingFriend) {
      throw new Error("You're already friends with this user");
    }

    const { data: existingRequest } = await supabase
      .from("friend_requests")
      .select("id, sender_id, status")
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`,
      )
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      throw new Error(
        existingRequest.sender_id === senderId
          ? "Friend request already sent"
          : "This user already sent you a friend request - check your pending requests",
      );
    }

    const { data, error } = await supabase
      .from("friend_requests")
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /** Pending requests sent TO this user, with the sender's public
   *  profile attached. `profiles` RLS only allows a user to see their
   *  own row, so the old `profiles!friend_requests_sender_id_fkey(...)`
   *  embed silently returned null for the sender on every row - it
   *  never errored, so the "Pending Requests" panel just quietly
   *  looked like every sender was "Unknown". Fetching the request
   *  rows and the sender profiles as two RLS-safe steps (the second
   *  via a SECURITY DEFINER batch lookup - see migration 034) fixes
   *  it for real. */
  static async getRequests(userId: string) {
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from("friend_requests")
      .select("id, created_at, sender_id")
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (!rows || rows.length === 0) {
      return [];
    }

    const senderIds = Array.from(new Set(rows.map((r) => r.sender_id)));
    const profilesById = await this.getProfilesById(senderIds);

    return rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      sender: profilesById.get(row.sender_id) ?? null,
    }));
  }

  /** This user's accepted friends, with each friend's public profile
   *  attached. `friends` stores one row per direction (both are
   *  written on accept), so a plain select on user_id is enough for
   *  the friendship rows themselves - it's the joined profile that
   *  needed the RLS-safe batch lookup (same issue as getRequests). */
  static async getFriends(userId: string) {
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from("friends")
      .select("id, created_at, friend_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (!rows || rows.length === 0) {
      return [];
    }

    const friendIds = Array.from(new Set(rows.map((r) => r.friend_id)));
    const profilesById = await this.getProfilesById(friendIds);

    return rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      friend: profilesById.get(row.friend_id) ?? null,
    }));
  }

  /** Batch-resolves public profile fields for a set of user ids via
   *  the get_public_profiles_by_ids RPC (migration 034), which runs
   *  SECURITY DEFINER and returns only safe columns - never email,
   *  phone, is_banned, or invite_code - regardless of whose ids are
   *  passed in. */
  static async getProfilesById(ids: string[]): Promise<Map<string, PublicProfile>> {
    if (ids.length === 0) {
      return new Map();
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_public_profiles_by_ids", {
      p_ids: ids,
    });

    if (error) {
      throw error;
    }

    return new Map((data ?? []).map((p: PublicProfile) => [p.id, p]));
  }

  /** How `viewerId` relates to `targetId` right now - used by the
   *  public profile page to decide whether to show "Add Friend",
   *  "Request Sent", "Friends", or nothing. Reads only the viewer's
   *  own friend/friend_request rows, so the existing RLS policies
   *  ("view own friends", "view own friend requests") already allow
   *  it without needing a definer function. */
  static async getFriendshipStatus(
    viewerId: string,
    targetId: string,
  ): Promise<FriendshipStatus> {
    if (viewerId === targetId) {
      return "self";
    }

    const supabase = await createClient();

    const { data: friendRow } = await supabase
      .from("friends")
      .select("id")
      .eq("user_id", viewerId)
      .eq("friend_id", targetId)
      .maybeSingle();

    if (friendRow) {
      return "friends";
    }

    const { data: requestRow } = await supabase
      .from("friend_requests")
      .select("id, sender_id")
      .or(
        `and(sender_id.eq.${viewerId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${viewerId})`,
      )
      .eq("status", "pending")
      .maybeSingle();

    if (requestRow) {
      return requestRow.sender_id === viewerId ? "request_sent" : "request_received";
    }

    return "none";
  }

  /** Accept or reject a request. Verifies the caller is actually the
   *  request's receiver (this check was entirely missing before - any
   *  authenticated user could POST any request_id), then performs the
   *  write with the admin client since accepting has to insert one
   *  friends row per direction for two different users, which a
   *  single per-row RLS policy can't express atomically. */
  static async respondToRequest(
    userId: string,
    requestId: string,
    action: "accepted" | "rejected",
  ) {
    const supabase = await createClient();

    const { data: friendRequest } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    if (friendRequest.receiver_id !== userId) {
      throw new Error("You can't respond to a request that wasn't sent to you");
    }

    if (friendRequest.status !== "pending") {
      throw new Error("This request has already been handled");
    }

    const admin = createAdminClient();

    const { error: updateErr } = await admin
      .from("friend_requests")
      .update({ status: action })
      .eq("id", requestId);

    if (updateErr) {
      throw updateErr;
    }

    if (action === "accepted") {
      const { error: friendErr } = await admin.from("friends").upsert(
        [
          { user_id: friendRequest.sender_id, friend_id: friendRequest.receiver_id },
          { user_id: friendRequest.receiver_id, friend_id: friendRequest.sender_id },
        ],
        { onConflict: "user_id,friend_id", ignoreDuplicates: true },
      );

      if (friendErr) {
        throw friendErr;
      }
    }

    return { status: action };
  }

  /** Finds up to 8 users by username (partial match), excluding the
   *  searcher themselves. Used by the "add friend" search box. This
   *  used to query `profiles` directly with the session client, which
   *  `profiles` RLS silently reduced to "only rows matching your own
   *  id" - i.e. it could never actually find anyone else. Now goes
   *  through the search_public_profiles RPC (migration 034) instead. */
  static async searchByUsername(query: string, excludeUserId: string): Promise<PublicProfile[]> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("search_public_profiles", {
      p_query: query,
      p_exclude_id: excludeUserId,
      p_limit: 8,
    });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /** Every user gets a permanent invite_code from signup (see
   *  migration 019). This just reads it back alongside a ready-to-share
   *  link. */
  static async getInviteLink(userId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("invite_code")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return {
      code: data.invite_code,
      link: `${baseUrl}/friends/invite/${data.invite_code}`,
    };
  }

  /** Resolves an invite code to its owner's public profile, or null if
   *  the code doesn't exist. Same RLS problem as searchByUsername - a
   *  direct `profiles` query here could only ever "resolve" your own
   *  code, so every invite link looked invalid to the person opening
   *  it. Now goes through the resolve_invite_code RPC (migration 034). */
  static async resolveInviteCode(code: string): Promise<PublicProfile | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc("resolve_invite_code", { p_code: code })
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /** Invite links skip the request/accept handshake entirely - opening
   *  a valid link while logged in instantly makes you friends, the
   *  same way the sender intended when they chose to share it. */
  static async acceptInvite(userId: string, code: string) {
    const owner = await this.resolveInviteCode(code);

    if (!owner) {
      throw new Error("This invite link is invalid or has expired");
    }

    if (owner.id === userId) {
      throw new Error("You can't use your own invite link");
    }

    const admin = createAdminClient();

    const { error } = await admin.from("friends").upsert(
      [
        { user_id: userId, friend_id: owner.id },
        { user_id: owner.id, friend_id: userId },
      ],
      { onConflict: "user_id,friend_id", ignoreDuplicates: true },
    );

    if (error) {
      throw error;
    }

    return owner;
  }
}
