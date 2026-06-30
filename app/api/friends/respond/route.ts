import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const supabase = await createClient();

    const { request_id, action } = body;

    const { data: friendRequest } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (!friendRequest) {
      throw new Error("Request not found");
    }

    await supabase
      .from("friend_requests")
      .update({
        status: action,
      })
      .eq("id", request_id);

    if (action === "accepted") {
      await supabase.from("friends").insert([
        {
          user_id: friendRequest.sender_id,
          friend_id: friendRequest.receiver_id,
        },
        {
          user_id: friendRequest.receiver_id,
          friend_id: friendRequest.sender_id,
        },
      ]);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
      },
      { status: 400 },
    );
  }
}
