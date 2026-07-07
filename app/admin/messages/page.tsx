import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContactMessagesTable from "@/components/admin/contact-messages-table";

export default async function AdminMessagesPage() {
  try { await requireAdmin(); } catch { redirect("/dashboard"); }
  const supabase = await createClient();

  const { data: submissions } = await supabase
    .from("contact_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = submissions ?? [];
  const newCount = rows.filter(r => r.status === "new").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white">Contact Messages</h2>
        <p className="text-sm text-[var(--lj-muted)]">
          Submissions from the public contact form.
          {newCount > 0 && ` ${newCount} unread.`}
        </p>
      </div>

      {rows.length === 0 && (
        <div className="lj-card flex items-center justify-center py-12 text-center">
          <div>
            <p className="text-4xl mb-2">📭</p>
            <p className="font-semibold text-white">No messages yet</p>
          </div>
        </div>
      )}

      {rows.length > 0 && <ContactMessagesTable initialSubmissions={rows} />}
    </div>
  );
}
