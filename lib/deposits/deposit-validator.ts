import { z } from "zod";

export const depositSchema = z.object({
  amount: z
    .number()
    .min(50, "Minimum deposit is 50 XAF")
    .max(100000, "Maximum deposit is 100000 XAF"),
});

export type DepositInput = z.infer<typeof depositSchema>;
