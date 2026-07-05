import { NextResponse } from "next/server";
import { MessageService } from "@/lib/messages/message-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ friendId: string }> },
) {
  try {
    const { friendId } = await params;
    const data = await MessageService.getConversation(friendId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load conversation";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ friendId: string }> },
) {
  // Used to mark a conversation as read when it's opened.
  try {
    const { friendId } = await params;
    await MessageService.markRead(friendId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mark conversation read";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
