import { createClient } from "@/lib/supabase/server";

export class FriendService {
  static async sendRequest(senderId: string, receiverId: string) {
    const supabase = await createClient();

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

  static async getRequests(userId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("receiver_id", userId)
      .eq("status", "pending");

    if (error) {
      throw error;
    }

    return data;
  }

  static async getFriends(userId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("friends")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return data;
  }
}
