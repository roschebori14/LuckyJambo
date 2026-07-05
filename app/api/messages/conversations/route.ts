import { NextResponse } from "next/server";
import { MessageService } from "@/lib/messages/message-service";

export async function GET() {
  try {
    const data = await MessageService.getConversations();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load conversations";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
