import { NextResponse } from "next/server";
import { moderateUsername } from "@/lib/ai/moderation";
import { z } from "zod";

const schema = z.object({ username: z.string().min(3).max(30) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await moderateUsername(body.username);
    return NextResponse.json({ success: true, ...result });
  } catch {
    // Fail open on validation errors too - registration form does its
    // own length/format checks; this endpoint is a content filter only.
    return NextResponse.json({ success: true, allowed: true, reason: "" });
  }
}
