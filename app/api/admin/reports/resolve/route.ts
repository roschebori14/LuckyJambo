import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  report_id: z.string().uuid(),
  action: z.enum(["refund", "dismiss"]),
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    const { data, error } = await supabase.rpc("resolve_match_report", {
      p_report_id: validated.report_id,
      p_action: validated.action,
      p_admin_notes: validated.notes ?? null,
    });

    if (error) throw error;
    return NextResponse.json({ success: true, report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve report";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
