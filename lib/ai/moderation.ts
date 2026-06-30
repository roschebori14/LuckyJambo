import { getChatCompletion } from "@/lib/ai/groq-client";
import { MODERATION_PROMPT } from "@/lib/ai/prompts";

interface ModerationResult {
  allowed: boolean;
  reason: string;
}

// Cheap local checks first so we don't burn an API call on the most
// obvious cases (also gives an instant result if Groq is ever down).
const BLOCKED_SUBSTRINGS = ["admin", "support", "luckyjambo", "fapshi", "moderator"];

export async function moderateUsername(username: string): Promise<ModerationResult> {
  const lower = username.toLowerCase();

  for (const blocked of BLOCKED_SUBSTRINGS) {
    if (lower.includes(blocked)) {
      return { allowed: false, reason: "Username cannot impersonate official accounts" };
    }
  }

  if (/\d{6,}/.test(username) || /@/.test(username) || /https?:\/\//.test(username)) {
    return { allowed: false, reason: "Username cannot contain phone numbers, emails, or links" };
  }

  // Fall through to the AI classifier for nuance (slurs in multiple
  // languages, subtle impersonation, etc.) that simple string checks miss.
  try {
    const raw = await getChatCompletion(
      [
        { role: "system", content: MODERATION_PROMPT },
        { role: "user", content: username },
      ],
      { model: "fast", temperature: 0, maxTokens: 100 },
    );

    const parsed = JSON.parse(raw.trim());
    if (typeof parsed.allowed === "boolean") {
      return { allowed: parsed.allowed, reason: parsed.reason ?? "" };
    }
  } catch {
    // If the AI call fails or returns malformed JSON, fail open rather
    // than blocking signups platform-wide on an outage - the local
    // checks above already caught the worst cases.
  }

  return { allowed: true, reason: "" };
}
