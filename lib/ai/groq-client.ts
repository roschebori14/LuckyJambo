import Groq from "groq-sdk";

// Server-side only. The API key must never be exposed to the client —
// every consumer of this module must run in an API route or Server
// Component, never in a "use client" file.
let _client: Groq | null = null;

export function getGroqClient(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set in environment variables");
    }
    _client = new Groq({ apiKey });
  }
  return _client;
}

// Centralised model choice so it's easy to swap later (e.g. to a
// larger model for admin analysis vs a fast one for chat).
export const AI_MODELS = {
  fast: "llama-3.1-8b-instant",   // chat, moderation, quick lookups
  reasoning: "llama-3.3-70b-versatile", // admin analysis, fraud detection
} as const;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Non-streaming completion - returns the full text at once.
 * Use for short, structured tasks (moderation, classification, summaries).
 */
export async function getChatCompletion(
  messages: ChatMessage[],
  options?: { model?: keyof typeof AI_MODELS; maxTokens?: number; temperature?: number }
): Promise<string> {
  const client = getGroqClient();
  const completion = await client.chat.completions.create({
    model: AI_MODELS[options?.model ?? "fast"],
    messages,
    temperature: options?.temperature ?? 0.7,
    max_completion_tokens: options?.maxTokens ?? 1024,
    top_p: 1,
    stream: false,
  });

  return completion.choices[0]?.message?.content ?? "";
}

/**
 * Streaming completion - returns an async generator of text chunks.
 * Use for chat UIs where you want tokens to appear as they're generated.
 */
export async function* getChatCompletionStream(
  messages: ChatMessage[],
  options?: { model?: keyof typeof AI_MODELS; maxTokens?: number; temperature?: number }
): AsyncGenerator<string> {
  const client = getGroqClient();
  const stream = await client.chat.completions.create({
    model: AI_MODELS[options?.model ?? "fast"],
    messages,
    temperature: options?.temperature ?? 1,
    max_completion_tokens: options?.maxTokens ?? 1024,
    top_p: 1,
    stream: true,
    stop: null,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield text;
  }
}

export type { ChatMessage };
