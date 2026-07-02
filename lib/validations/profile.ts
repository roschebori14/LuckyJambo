import { z } from "zod";

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or fewer")
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),

  full_name: z.string().max(80, "Full name must be 80 characters or fewer").optional(),

  bio: z.string().max(280, "Bio must be 280 characters or fewer").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
