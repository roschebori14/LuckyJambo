import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { FriendService } from "@/lib/friends/friend-service";

export async function GET() {
  try {
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

    const invite = await FriendService.getInviteLink(user.id);

    return NextResponse.json({ success: true, ...invite });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not load invite link",
      },
      { status: 400 },
    );
  }
}
