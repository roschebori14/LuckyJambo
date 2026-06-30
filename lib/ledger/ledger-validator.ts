import { z } from "zod";

export const ledgerEntrySchema = z.object({
  user_id: z.string(),

  transaction_type: z.enum([
    "deposit",
    "withdrawal",
    "match_stake",
    "match_win",
    "match_loss",
    "refund",
    "bonus",
    "admin_adjustment",
  ]),

  amount: z.number(),

  balance_before: z.number(),

  balance_after: z.number(),

  reference: z.string(),

  description: z.string().optional(),
});

export type LedgerInput = z.infer<typeof ledgerEntrySchema>;
