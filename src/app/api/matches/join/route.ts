import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { matchId } = await req.json();

    const { data: match } = await supabase.from('matches')
      .select('*, game:games(name,min_stake,max_stake)')
      .eq('id', matchId).single();

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.status !== 'waiting') return NextResponse.json({ error: 'Match already started or ended' }, { status: 400 });
    if (match.creator_id === user.id) return NextResponse.json({ error: 'Cannot join your own match' }, { status: 400 });
    if (match.opponent_id && match.opponent_id !== user.id) return NextResponse.json({ error: 'This match is reserved for someone else' }, { status: 400 });

    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
    if (!wallet || wallet.available_balance < match.stake) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Lock opponent stake
    const newAvailable = wallet.available_balance - match.stake;
    const newLocked = wallet.locked_balance + match.stake;

    await supabase.from('wallets').update({ available_balance: newAvailable, locked_balance: newLocked }).eq('user_id', user.id);

    await supabase.from('wallet_ledger').insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: 'match_stake',
      amount: -match.stake,
      balance_after: newAvailable,
      reference_id: matchId,
      description: `Stake locked for ${match.game?.name} match`,
    });

    // Update match to active
    await supabase.from('matches').update({
      opponent_id: user.id,
      status: 'active',
      game_state: getInitialGameState(match.game_id, match.creator_id, user.id),
    }).eq('id', matchId);

    // Add as participant
    await supabase.from('match_participants').insert({ match_id: matchId, user_id: user.id });

    // Notify creator
    await supabase.from('notifications').insert({
      user_id: match.creator_id,
      title: 'Match Started!',
      message: 'An opponent joined your match. Game is now active!',
      type: 'match_started',
      data: { match_id: matchId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Join match error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function getInitialGameState(gameId: string, creator: string, opponent: string) {
  return {
    turn: creator,
    creator,
    opponent,
    board: null,
    moves: [],
    startedAt: new Date().toISOString(),
  };
}
