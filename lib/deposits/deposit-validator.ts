import { z } from "zod";

export const depositSchema = z.object({
  amount: z
    .number()
    .min(50, "Minimum deposit is 50 XAF")
    .max(100000, "Maximum deposit is 100000 XAF"),

  phone: z
    .string()
    .min(9, "Phone number must be at least 9 digits")
    .max(15, "Phone number too long")
    .regex(/^\d+$/, "Phone number must contain only digits"),
});

export type DepositInput = z.infer<typeof depositSchema>;
