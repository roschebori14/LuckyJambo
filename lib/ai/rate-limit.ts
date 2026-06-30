import { createClient } from "@/lib/supabase/server";

const WINDOW_MINUTES = 1;
const MAX_REQUESTS_PER_WINDOW = 8;

/**
 * Checks whether a user has exceeded the AI assistant rate limit, and
 * logs this request if they haven't. Cheap guard against runaway
 * Groq API costs from a single user spamming the chat endpoint.
 */
export async function checkAiRateLimit(
  userId: string,
  assistantType: "support" | "admin_analyst",
  messagePreview: string,
): Promise<{ allowed: boolean; message?: string }> {
  const supabase = await createClient();

  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("ai_chat_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      message: `You're sending messages too quickly. Please wait a moment and try again.`,
    };
  }

  await supabase.from("ai_chat_logs").insert({
    user_id: userId,
    assistant_type: assistantType,
    message_preview: messagePreview.slice(0, 300),
  });

  return { allowed: true };
}
