import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/validations/contact";
import { createAdminClient } from "@/lib/supabase/admin";

// Rate limit: max 5 submissions per IP per hour, backed by the
// contact_submissions table (see migration 062_contact_submissions.sql)
// instead of an in-memory Map. A process-local Map resets on every deploy/cold
// start and is tracked independently by each concurrent serverless
// instance, so the effective limit was "5 per hour per instance", not
// per IP. A shared table enforces the real limit regardless of which
// instance handles a given request.
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

async function isRateLimited(ip: string): Promise<boolean> {
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    // createAdminClient() throws synchronously if Supabase admin env vars
    // (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) are missing.
    // That used to bubble straight past every console.error in this file
    // and out to the outer catch, so a misconfigured deployment produced
    // the generic error message with *zero* server log output - nothing
    // to diagnose from. Log it explicitly and fail open, same policy as
    // the query-error case below.
    console.error("Contact rate-limit check failed: could not create Supabase admin client.", err);
    return false;
  }

  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count, error } = await admin
    .from("contact_submissions")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);

  if (error) {
    // Fail open on infra errors rather than blocking every legitimate
    // submission if the rate-limit check itself is unavailable - the
    // Resend call below still requires valid env vars, so this isn't
    // an open door to abuse the API key.
    console.error("Contact rate-limit check failed:", error);
    return false;
  }

  return (count ?? 0) >= RATE_LIMIT;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, message: "Too many messages sent. Please try again later." },
        { status: 429 },
      );
    }

    const body = contactSchema.parse(await request.json());

    // Record this attempt against the IP's budget before sending, same
    // as the old Map-based version incrementing on every check - a
    // failed/duplicate send still consumes one of the 5 slots so a
    // client can't bypass the limit by retrying a failing request.
    // Also stores the full message content (not just ip/email) so the
    // admin panel has something to actually review, independent of
    // whether the Resend email below succeeds.
    let admin;
    try {
      admin = createAdminClient();
    } catch (err) {
      console.error("Contact form: could not create Supabase admin client.", err);
      admin = null;
    }

    if (admin) {
      const { error: logError } = await admin
        .from("contact_submissions")
        .insert({
          ip,
          name: body.name,
          email: body.email,
          subject: body.subject,
          message: body.message,
        });
      if (logError) {
        console.error("Contact rate-limit logging failed:", logError);
      }
    }

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
    // This used to swallow every error with no console output at all,
    // which is why a misconfigured deployment (e.g. missing env vars)
    // showed the generic message to the user but nothing in Vercel's
    // logs to diagnose it from.
    console.error("Contact form submission failed:", error);
    const message =
      error instanceof Error && error.name === "ZodError"
        ? "Please check the form for errors and try again."
        : "Something went wrong sending your message. Please try again.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
