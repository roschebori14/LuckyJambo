import { createClient } from "@/lib/supabase/server";

export class MatchService {
  static async createMatch(
    creatorId: string,
    gameId: string,
    stakeAmount: number,
  ) {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("matches")
      .insert({
        creator_id: creatorId,
        game_id: gameId,
        stake_amount: stakeAmount,
        status: "waiting",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  static async getOpenMatches() {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "waiting");

    if (error) {
      throw error;
    }

    return data;
  }
}
