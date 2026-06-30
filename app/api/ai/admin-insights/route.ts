import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getChatCompletion, type ChatMessage } from "@/lib/ai/groq-client";
import { ADMIN_ANALYST_PROMPT } from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { z } from "zod";

async function requireAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return user;
}

/**
 * Pulls a snapshot of recent platform activity. Kept deliberately
 * narrow (counts + recent rows, not full history) so the prompt sent
 * to Groq stays small and cheap, and so we're not handing an LLM
 * provider more user data than it needs.
 */
async function gatherPlatformSnapshot() {
  const admin = createAdminClient();

  const [
    { count: totalUsers },
    { count: totalMatches },
    { data: recentWithdrawals },
    { data: recentDeposits },
    { data: highVolumeUsers },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("matches").select("*", { count: "exact", head: true }),
    admin.from("withdrawals")
      .select("user_id, amount, status, provider, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("deposits")
      .select("user_id, amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("match_participants")
      .select("user_id")
      .limit(500),
  ]);

  // Count matches per user client-side (cheap at this scale) to surface
  // unusually high-volume players for the model to comment on.
  const volumeMap = new Map<string, number>();
  for (const row of highVolumeUsers ?? []) {
    volumeMap.set(row.user_id, (volumeMap.get(row.user_id) ?? 0) + 1);
  }
  const topVolume = [...volumeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([user_id, count]) => ({ user_id, match_count: count }));

  return {
    totalUsers,
    totalMatches,
    recentWithdrawals: recentWithdrawals ?? [],
    recentDeposits: recentDeposits ?? [],
    topVolumeUsers: topVolume,
  };
}

const askSchema = z.object({
  question: z.string().min(1).max(1000).optional(),
});

export async function POST(request: Request) {
  const user = await requireAdminUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
  }

  let question = "";
  try {
    const body = askSchema.parse(await request.json().catch(() => ({})));
    question = body.question ?? "";
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
  }

  const rateCheck = await checkAiRateLimit(user.id, "admin_analyst", question || "auto-summary");
  if (!rateCheck.allowed) {
    return NextResponse.json({ success: false, message: rateCheck.message }, { status: 429 });
  }

  const snapshot = await gatherPlatformSnapshot();

  const contextBlock = `Current platform snapshot:
- Total users: ${snapshot.totalUsers}
- Total matches: ${snapshot.totalMatches}
- Recent withdrawals (last 30): ${JSON.stringify(snapshot.recentWithdrawals)}
- Recent deposits (last 30): ${JSON.stringify(snapshot.recentDeposits)}
- Top 5 users by match volume (sample of last 500 participations): ${JSON.stringify(snapshot.topVolumeUsers)}`;

  const userPrompt = question
    ? `${contextBlock}\n\nAdmin question: ${question}`
    : `${contextBlock}\n\nGive a brief summary of platform health and flag anything worth investigating.`;

  const messages: ChatMessage[] = [
    { role: "system", content: ADMIN_ANALYST_PROMPT },
    { role: "user", content: userPrompt },
  ];

  try {
    const answer = await getChatCompletion(messages, { model: "reasoning", temperature: 0.3, maxTokens: 800 });
    return NextResponse.json({ success: true, answer });
  } catch (error) {
    return NextResponse.json({ success: false, message: "AI analysis failed. Try again shortly." }, { status: 500 });
  }
}
