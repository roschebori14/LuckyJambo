import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/validations/contact";

// Simple in-memory rate limit: max 5 submissions per IP per hour.
// Resets on server restart/redeploy, which is an acceptable tradeoff for a
// low-volume contact form (vs. pulling in a persistent store).
const submissions = new Map<string, number[]>();
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (submissions.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  submissions.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, message: "Too many messages sent. Please try again later." },
        { status: 429 },
      );
    }

    const body = contactSchema.parse(await request.json());

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const supportEmail = process.env.SUPPORT_EMAIL;

    if (!apiKey || !from || !supportEmail) {
      console.error("Contact form: missing RESEND_API_KEY, EMAIL_FROM, or SUPPORT_EMAIL env vars");
      return NextResponse.json(
        { success: false, message: "Contact form is temporarily unavailable. Please email us directly." },
        { status: 500 },
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Lucky Jambo Contact Form <${from}>`,
        to: [supportEmail],
        reply_to: body.email,
        subject: `[Contact] ${body.subject}`,
        text: `From: ${body.name} <${body.email}>\n\n${body.message}`,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", errText);
      throw new Error("Failed to send message");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "ZodError"
        ? "Please check the form for errors and try again."
        : "Something went wrong sending your message. Please try again.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
