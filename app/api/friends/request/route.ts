import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { FriendService } from "@/lib/friends/friend-service";
import { sendFriendRequestSchema } from "@/lib/friends/friend-validator";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validated = sendFriendRequestSchema.parse(body);

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const result = await FriendService.sendRequest(
      user.id,
      validated.receiver_id,
    );

    return NextResponse.json({
      success: true,
      request: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Request failed",
      },
      { status: 400 },
    );
  }
}
