import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const [{ data: friends }, { data: incoming }, { data: outgoing }] = await Promise.all([
      supabase.from("friends").select("friend_id, profiles!friends_friend_id_fkey(id, username)").eq("user_id", user.id),
      supabase.from("friend_requests").select("id, sender_id, profiles!friend_requests_sender_id_fkey(username)").eq("receiver_id", user.id).eq("status", "pending"),
      supabase.from("friend_requests").select("id, receiver_id, status, profiles!friend_requests_receiver_id_fkey(username)").eq("sender_id", user.id).eq("status", "pending"),
    ]);

    return NextResponse.json({ success: true, friends: friends ?? [], incoming: incoming ?? [], outgoing: outgoing ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
