import { NextResponse } from "next/server";
import { z } from "zod";
import { MessageService } from "@/lib/messages/message-service";

const schema = z.object({
  receiver_id: z.string().uuid(),
  message: z.string().min(1).max(1000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    const data = await MessageService.send(validated.receiver_id, validated.message);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send message";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
