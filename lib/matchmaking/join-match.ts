/** POST /api/matches/join (or /api/ludo/join), with brief retries when
 *  word-rush create+seed hasn't finished yet (068 guard message). */
export async function joinMatchRequest(
  endpoint: string,
  matchId: string,
  maxAttempts = 6,
): Promise<{ success: boolean; message?: string; match?: unknown }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: matchId }),
    });
    const json = await res.json();

    if (json.success) return json;

    const retryable =
      typeof json.message === "string" &&
      json.message.includes("still being set up");

    if (!retryable || attempt === maxAttempts - 1) {
      return json;
    }

    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }

  return { success: false, message: "Failed to join match" };
}
