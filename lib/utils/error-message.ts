/**
 * Extracts a human-readable message from a caught error, and always
 * logs the raw error server-side first.
 *
 * The naive `error instanceof Error ? error.message : fallback` check
 * used to be copy-pasted across nearly every API route here, and is
 * silently wrong for the single most common error this app throws:
 * Supabase's PostgrestError (what `supabase.rpc(...)` rejects with on
 * any raised Postgres exception) is a plain `{message, details, hint,
 * code}` object in this project's client version, not a real `Error`
 * subclass - so `instanceof Error` evaluates false, and the real
 * message (which is usually a deliberately user-facing RAISE
 * EXCEPTION string from one of this project's RPCs) gets thrown away
 * in favor of a generic fallback. On top of that, none of those catch
 * blocks logged anything server-side either, so the real error was
 * genuinely unrecoverable after the fact - not visible to the user,
 * not visible in Vercel logs.
 *
 * This checks for a `.message` string on any object shape (covers
 * real Error instances, PostgrestError, ZodError, and anything else
 * with a conventional `.message` field) rather than gatekeeping on
 * the exact prototype chain, and unconditionally console.errors the
 * original error first so it's always in the server logs regardless
 * of what gets shown to the user.
 */
export function getErrorMessage(error: unknown, fallback: string, context?: string): string {
  console.error(context ?? "Request failed", error);

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string" &&
    (error as { message: string }).message.length > 0
  ) {
    return (error as { message: string }).message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallback;
}
