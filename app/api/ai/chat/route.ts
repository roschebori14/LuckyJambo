import { createClient } from "@/lib/supabase/server";
import { getChatCompletionStream, type ChatMessage } from "@/lib/ai/groq-client";
import { SUPPORT_ASSISTANT_PROMPT } from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { z } from "zod";

const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000),
  })).min(1).max(20), // cap history length sent per request
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return new Response(JSON.stringify({ success: false, message: "Invalid request" }), { status: 400 });
  }

  const lastUserMessage = [...body.messages].reverse().find(m => m.role === "user");
  const rateCheck = await checkAiRateLimit(user.id, "support", lastUserMessage?.content ?? "");
  if (!rateCheck.allowed) {
    return new Response(JSON.stringify({ success: false, message: rateCheck.message }), { status: 429 });
  }

  const chatMessages: ChatMessage[] = [
    { role: "system", content: SUPPORT_ASSISTANT_PROMPT },
    ...body.messages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of getChatCompletionStream(chatMessages, { model: "fast", temperature: 0.6 })) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        controller.enqueue(encoder.encode("\n\n[Sorry, I hit an error. Please try again.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
