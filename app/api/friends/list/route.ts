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
        {
          success: false,
        },
        { status: 401 },
      );
    }

    const friends = await FriendService.getFriends(user.id);

    return NextResponse.json({
      success: true,
      friends,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
      },
      { status: 500 },
    );
  }
}
