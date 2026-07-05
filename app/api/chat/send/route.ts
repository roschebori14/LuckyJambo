import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { MATCH_CHAT_PRESETS } from "@/lib/games/match-chat-presets";

const sendSchema = z.object({
  match_id: z.string().uuid(),
  message: z.enum(MATCH_CHAT_PRESETS),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const body = await request.json();
    const validated = sendSchema.parse(body);

    // The insert itself is the real enforcement point: RLS
    // ("send match chat as participant" in 047_match_chat.sql) checks
    // participant + active-match + not-banned, and a BEFORE INSERT
    // trigger enforces the 2s-per-user cooldown. This route just gives
    // those failures friendlier messages than a raw Postgres error.
    const { data, error } = await supabase
      .from("match_chat_messages")
      .insert({
        match_id: validated.match_id,
        user_id: user.id,
        message: validated.message,
      })
      .select("id, match_id, user_id, message, created_at")
      .single();

    if (error) {
      if (error.message.includes("too quickly")) {
        return NextResponse.json({ success: false, message: "You're sending messages too quickly." }, { status: 429 });
      }
      if (error.code === "42501" || error.message.includes("row-level security")) {
        return NextResponse.json(
          { success: false, message: "You can't chat in this match right now." },
          { status: 403 },
        );
      }
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, chat_message: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send message";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
