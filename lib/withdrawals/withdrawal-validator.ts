import { z } from "zod";
import {
  MINIMUM_WITHDRAWAL,
  MAXIMUM_WITHDRAWAL,
} from "@/lib/wallet/wallet-constants";

export const withdrawalSchema = z.object({
  amount: z
    .number()
    .min(MINIMUM_WITHDRAWAL, `Minimum withdrawal is ${MINIMUM_WITHDRAWAL} XAF`)
    .max(MAXIMUM_WITHDRAWAL, `Maximum withdrawal is ${MAXIMUM_WITHDRAWAL} XAF`),

  account_number: z
    .string()
    .min(9, "Phone number must be at least 9 digits")
    .max(15, "Phone number too long")
    .regex(/^\d+$/, "Phone number must contain only digits"),

  provider: z.enum(["mtn", "orange"]),
});

export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
