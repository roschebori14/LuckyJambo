import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PUBLIC_PROFILE_FIELDS = "id, username, avatar_url, is_verified";

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
   *  profile joined in so the UI has a username to show. */
  static async getRequests(userId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("friend_requests")
      .select(`id, created_at, sender:profiles!friend_requests_sender_id_fkey(${PUBLIC_PROFILE_FIELDS})`)
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  /** This user's accepted friends, with each friend's public profile
   *  joined in. `friends` stores one row per direction (both are
   *  written on accept), so a plain select on user_id is enough. */
  static async getFriends(userId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("friends")
      .select(`id, created_at, friend:profiles!friends_friend_id_fkey(${PUBLIC_PROFILE_FIELDS})`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data;
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
   *  searcher themselves. Used by the "add friend" search box. */
  static async searchByUsername(query: string, excludeUserId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select(PUBLIC_PROFILE_FIELDS)
      .ilike("username", `%${query}%`)
      .neq("id", excludeUserId)
      .limit(8);

    if (error) {
      throw error;
    }

    return data;
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
   *  the code doesn't exist. */
  static async resolveInviteCode(code: string) {
    const supabase = await createClient();

    const { data } = await supabase
      .from("profiles")
      .select(PUBLIC_PROFILE_FIELDS)
      .eq("invite_code", code)
      .maybeSingle();

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
