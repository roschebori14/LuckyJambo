import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Powers the post-match result panel. Deliberately NOT just "recompute
// stake * 2 * (1 - fee%)" on the client - that duplicates settlement
// math and can drift out of sync with it (different games use slightly
// different payout paths: settle_match, early_exit_match...). Instead
// this reads the *actual* wallet_ledger row that settlement already
// wrote for this user or this match (every balance change is required
// to have a ledger entry - see wallet_ledger in docs/database-schema.md),
// so the number shown is always exactly what actually happened to the
// wallet, no matter which settlement path produced it.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, message: "id required" }, { status: 400 });

    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, status, winner_id, end_reason, stake_amount, creator_id")
      .eq("id", id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    }

    if (match.status !== "completed") {
      return NextResponse.json({ success: true, settled: false });
    }

    // The exact ledger row settlement wrote for THIS user on THIS
    // match - 'match_win' / 'match_loss' from settle_match, or
    // 'match_win' / 'refund' from early_exit_match (the exiting
    // player gets a 'refund' entry, not 'match_loss', since they keep
    // most of their stake back rather than losing it outright).
    const { data: ledgerRow } = await supabase
      .from("wallet_ledger")
      .select("type, amount, balance_after")
      .eq("user_id", user.id)
      .eq("reference", id)
      .in("type", ["match_win", "match_loss", "refund"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let opponentUsername: string | null = null;
    const { data: participantRows } = await supabase
      .from("match_participants")
      .select("user_id")
      .eq("match_id", id);
    const opponentId = participantRows?.map((p) => p.user_id).find((uid) => uid !== user.id) ?? null;
    if (opponentId) {
      const { data: opponentProfiles } = await supabase.rpc("get_public_profiles_by_ids", {
        p_ids: [opponentId],
      });
      opponentUsername = opponentProfiles?.[0]?.username ?? null;
    }

    const won = match.winner_id === user.id;
    const outcome: "win" | "loss" | null = ledgerRow
      ? ledgerRow.type === "match_win"
        ? "win"
        : "loss"
      : won
      ? "win"
      : match.winner_id
      ? "loss"
      : null;

    return NextResponse.json({
      success: true,
      settled: true,
      outcome,
      amount: ledgerRow?.amount ?? null,
      newBalance: ledgerRow?.balance_after ?? null,
      endReason: match.end_reason ?? "normal",
      wasEarlyExit: ledgerRow?.type === "refund",
      opponentUsername,
      stakeAmount: match.stake_amount,
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
