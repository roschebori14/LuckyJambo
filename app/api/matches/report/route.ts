import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  match_id: z.string().uuid(),
  reason: z.string().min(10).max(500),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    const { data, error } = await supabase
      .from("match_reports")
      .insert({ match_id: validated.match_id, reporter_id: user.id, reason: validated.reason })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: false, message: "You've already reported this match" }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit report";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
