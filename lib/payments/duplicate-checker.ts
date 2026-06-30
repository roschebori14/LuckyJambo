import { createClient } from "@/lib/supabase/server";

export class DuplicateChecker {
  static async alreadyCompleted(reference: string) {
    const supabase = await createClient();

    const { data } = await supabase
      .from("deposits")
      .select("status")
      .eq("payment_reference", reference)
      .single();

    return data?.status === "completed";
  }
}
