import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "read", "archived"]),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const validated = schema.parse(await request.json());

    // No manual role check needed here - the "admins update contact
    // submissions" RLS policy (062_contact_submissions.sql) already
    // restricts this update to admins. A non-admin's request will
    // simply match zero rows.
    const { data, error } = await supabase
      .from("contact_submissions")
      .update({ status: validated.status })
      .eq("id", validated.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, submission: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update message";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
