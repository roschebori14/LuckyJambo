import { z } from "zod";

export const updateProfileSchema = z.object({
  // Strip whitespace before validating/saving - mobile keyboards and
  // autocomplete often add a stray leading/trailing space, and the
  // character-set regex below has always rejected any username
  // containing a space outright (the actual root cause behind users
  // reporting they "can't register/save because of a space").
  // Accept the space as typed, just don't persist it.
  username: z.preprocess(
    (val) => (typeof val === "string" ? val.replace(/\s+/g, "") : val),
    z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be 30 characters or fewer")
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
  ),

  full_name: z.string().max(80, "Full name must be 80 characters or fewer").optional(),

  bio: z.string().max(280, "Bio must be 280 characters or fewer").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
