import { createClient } from "@/lib/supabase/client";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/profile";

export class ProfileService {
  /** Validates then persists a profile edit. Empty strings for the
   *  optional fields are normalized to null so clearing a field in
   *  the form actually clears it in the database instead of storing
   *  an empty string. */
  static async update(userId: string, input: UpdateProfileInput) {
    const validated = updateProfileSchema.parse(input);

    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        username: validated.username,
        full_name: validated.full_name?.trim() || null,
        bio: validated.bio?.trim() || null,
      })
      .eq("id", userId);

    if (error) {
      // profiles.username has a unique constraint - surface that as a
      // clear message instead of a raw Postgres error code.
      if (error.code === "23505") {
        throw new Error("That username is already taken");
      }
      throw error;
    }
  }
}
