import { createClient } from "@/lib/supabase/server";

export class MessageService {
  /** Sends a DM as the current session's user. RLS (direct_messages'
   *  "send direct messages to friends" policy) is the real enforcement
   *  of the friends-only rule - this just gives a clean error message
   *  instead of a raw Postgres constraint violation surfacing to the
   *  client. */
  static async send(receiverId: string, message: string) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Not authenticated");
    if (user.id === receiverId) throw new Error("You can't message yourself");

    const trimmed = message.trim();
    if (!trimmed) throw new Error("Message can't be empty");
    if (trimmed.length > 1000) throw new Error("Message is too long (max 1000 characters)");

    const { data, error } = await supabase
      .from("direct_messages")
      .insert({ sender_id: user.id, receiver_id: receiverId, message: trimmed })
      .select()
      .single();

    if (error) {
      // RLS violation on the "send direct messages to friends" policy
      // surfaces as a generic permission-denied error - translate it
      // into something the sender can actually act on.
      if (error.code === "42501") {
        throw new Error("You can only message people you're friends with");
      }
      throw error;
    }

    return data;
  }

  /** Full conversation history with one specific friend, oldest first. */
  static async getConversation(friendId: string, limit = 100) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`,
      )
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }

  /** Inbox summary: one row per conversation, most recent first. */
  static async getConversations() {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_dm_conversations");
    if (error) throw error;
    return data ?? [];
  }

  /** Marks every message from `friendId` to the current user as read
   *  (called when opening that conversation thread). */
  static async markRead(friendId: string) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("direct_messages")
      .update({ is_read: true })
      .eq("sender_id", friendId)
      .eq("receiver_id", user.id)
      .eq("is_read", false);

    if (error) throw error;
  }
}
