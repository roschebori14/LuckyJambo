import { createClient } from "@/lib/supabase/server";
import { AdminStats } from "@/types/admin";

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();

  const [users, deposits, withdrawals, matches] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("deposits").select("amount"),
    supabase.from("withdrawals").select("amount"),
    supabase.from("matches").select("*", { count: "exact", head: true }),
  ]);

  const totalDeposits =
    deposits.data?.reduce((a, b) => a + Number(b.amount), 0) ?? 0;

  const totalWithdrawals =
    withdrawals.data?.reduce((a, b) => a + Number(b.amount), 0) ?? 0;

  return {
    totalUsers: users.count ?? 0,
    activeUsers: 0,
    totalDeposits,
    totalWithdrawals,
    totalRevenue: 0,
    totalMatches: matches.count ?? 0,
    pendingWithdrawals: 0,
  };
}
