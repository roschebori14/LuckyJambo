import { z } from "zod";

export const depositSchema = z.object({
  amount: z
    .number()
    .min(50, "Minimum deposit is 50 XAF")
    .max(100000, "Maximum deposit is 100000 XAF"),
});

export const withdrawalSchema = z.object({
  amount: z
    .number()
    .min(500, "Minimum withdrawal is 500 XAF")
    .max(100000, "Maximum withdrawal is 100000 XAF"),
});

export const walletAdjustmentSchema = z.object({
  amount: z.number(),
  reason: z.string().min(3).max(255),
  reference: z.string().optional(),
});

export type DepositInput = z.infer<typeof depositSchema>;

export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

export type WalletAdjustmentInput = z.infer<typeof walletAdjustmentSchema>;
