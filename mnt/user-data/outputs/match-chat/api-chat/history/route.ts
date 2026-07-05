import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// How many recent messages to load on first render - the realtime
// subscription (see hooks/use-match-chat-realtime.ts) takes over from
// there for anything sent after the page loads.
const HISTORY_LIMIT = 50;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("match_id");
    if (!matchId) {
      return NextResponse.json({ success: false, message: "match_id required" }, { status: 400 });
    }

    // RLS ("view own match chat" in 047_match_chat.sql) already scopes
    // this to matches the caller is actually a participant of - an
    // unrelated match_id here just returns an empty list, not an error.
    const { data, error } = await supabase
      .from("match_chat_messages")
      .select("id, match_id, user_id, message, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true })
      .limit(HISTORY_LIMIT);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, messages: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, message: "Could not load chat history" }, { status: 500 });
  }
}
