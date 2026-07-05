import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Singleton: every call site (PresenceProvider, SoundProvider,
// useDirectMessageRealtime, conversation pages, etc.) used to get its
// own brand-new SupabaseClient - and therefore its own brand-new
// Realtime/GoTrueClient pair - which is how the DM toast bug happened
// (see useDirectMessageRealtime.ts). Reusing one client means there's
// only ever one auth session to hydrate and one Realtime socket whose
// auth token gets kept in sync, instead of N independently-racing
// copies.
let client: SupabaseClient | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
