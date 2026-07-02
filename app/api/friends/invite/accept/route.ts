import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { FriendService } from "@/lib/friends/friend-service";
import { acceptInviteSchema } from "@/lib/friends/friend-validator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = acceptInviteSchema.parse(body);

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

    const friend = await FriendService.acceptInvite(user.id, validated.code);

    return NextResponse.json({ success: true, friend });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not accept invite",
      },
      { status: 400 },
    );
  }
}
