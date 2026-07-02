import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { FriendService } from "@/lib/friends/friend-service";
import { respondFriendRequestSchema } from "@/lib/friends/friend-validator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = respondFriendRequestSchema.parse(body);

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const result = await FriendService.respondToRequest(
      user.id,
      validated.request_id,
      validated.action,
    );

    return NextResponse.json({ success: true, ...result });
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
