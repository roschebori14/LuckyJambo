import { createClient } from "@/lib/supabase/server";
import type { PublicProfileDetail } from "@/types/profile";

/** Read-only lookups for viewing *other* users' profiles. Kept
 *  separate from ProfileService (which handles editing your own
 *  profile via the browser client) since this always runs
 *  server-side and goes through the get_public_profile RPC
 *  (migration 034) rather than querying `profiles` directly -
 *  `profiles` RLS only allows a user to see their own row, so a
 *  direct query here would never find anyone else. */
export class PublicProfileService {
  static async getByUsername(username: string): Promise<PublicProfileDetail | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc("get_public_profile", { p_username: username })
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as PublicProfileDetail | null;
  }
}
