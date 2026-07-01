import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ username: z.string().min(1).max(30) });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = schema.parse(await request.json());
    const { data, error } = await supabase.rpc("send_friend_request", { p_receiver_username: body.username });
    if (error) throw error;
    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
  }
}
