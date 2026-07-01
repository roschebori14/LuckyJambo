import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ request_id: z.string().uuid(), accept: z.boolean() });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = schema.parse(await request.json());
    const { data, error } = await supabase.rpc("respond_friend_request", {
      p_request_id: body.request_id, p_accept: body.accept,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 });
  }
}
