import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId, action } = await req.json();

  const { data: request } = await supabase.from('friend_requests').select('*').eq('id', requestId).single();
  if (!request || request.receiver_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await supabase.from('friend_requests').update({ status: action }).eq('id', requestId);

  if (action === 'accepted') {
    await supabase.from('friends').insert([
      { user_id: user.id, friend_id: request.sender_id },
      { user_id: request.sender_id, friend_id: user.id },
    ]);
    await supabase.from('notifications').insert({
      user_id: request.sender_id,
      title: 'Friend Request Accepted',
      message: 'Your friend request was accepted!',
      type: 'friend_accepted',
    });
  }

  return NextResponse.json({ success: true });
}
