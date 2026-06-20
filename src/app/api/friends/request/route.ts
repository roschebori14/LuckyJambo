import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { receiverId } = await req.json();
  if (!receiverId || receiverId === user.id) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { error } = await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: receiverId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('notifications').insert({
    user_id: receiverId,
    title: 'Friend Request',
    message: 'Someone sent you a friend request.',
    type: 'friend_request',
  });

  return NextResponse.json({ success: true });
}
