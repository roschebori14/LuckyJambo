import { z } from "zod";

export const createMatchSchema = z.object({
  game_id: z.string(),

  stake_amount: z.number().min(100),
});

export const joinMatchSchema = z.object({
  match_id: z.string(),
});
