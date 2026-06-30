import { createClient } from "@/lib/supabase/server";

export async function getRevenue() {
  const supabase = await createClient();

  const { data } = await supabase.from("transactions").select("platform_fee");

  const totalRevenue =
    data?.reduce((sum, item) => sum + Number(item.platform_fee ?? 0), 0) ?? 0;

  return totalRevenue;
}
