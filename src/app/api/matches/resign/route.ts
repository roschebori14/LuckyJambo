import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateWinnings } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { matchId } = await req.json();

    const { data: match } = await supabase.from('matches')
      .select('*, game:games(name)')
      .eq('id', matchId).single();

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.status !== 'active') return NextResponse.json({ error: 'Match is not active' }, { status: 400 });
    if (match.creator_id !== user.id && match.opponent_id !== user.id) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const winnerId = match.creator_id === user.id ? match.opponent_id : match.creator_id;
    const { winnerReceives } = calculateWinnings(match.stake);

    // Mark match completed
    await supabase.from('matches').update({
      status: 'completed',
      winner_id: winnerId,
      completed_at: new Date().toISOString(),
    }).eq('id', matchId);

    // Unlock and credit winner
    const { data: winnerWallet } = await supabase.from('wallets').select('*').eq('user_id', winnerId).single();
    if (winnerWallet) {
      const newAvailable = winnerWallet.available_balance + winnerReceives;
      const newLocked = Math.max(0, winnerWallet.locked_balance - match.stake);
      await supabase.from('wallets').update({ available_balance: newAvailable, locked_balance: newLocked }).eq('user_id', winnerId);
      await supabase.from('wallet_ledger').insert({
        wallet_id: winnerWallet.id,
        user_id: winnerId,
        type: 'match_win',
        amount: winnerReceives,
        balance_after: newAvailable,
        reference_id: matchId,
        description: `Won ${match.game?.name} match (opponent resigned)`,
      });
    }

    // Unlock loser locked balance (already deducted from available on stake lock)
    const loserId = user.id;
    const { data: loserWallet } = await supabase.from('wallets').select('*').eq('user_id', loserId).single();
    if (loserWallet) {
      const newLocked = Math.max(0, loserWallet.locked_balance - match.stake);
      await supabase.from('wallets').update({ locked_balance: newLocked }).eq('user_id', loserId);
    }

    // Notifications
    await supabase.from('notifications').insert([
      {
        user_id: winnerId,
        title: 'Match Won!',
        message: `Your opponent resigned. You won ${winnerReceives.toLocaleString()} XAF!`,
        type: 'match_win',
        data: { match_id: matchId },
      },
      {
        user_id: loserId,
        title: 'Match Resigned',
        message: `You resigned the ${match.game?.name} match.`,
        type: 'match_loss',
        data: { match_id: matchId },
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resign error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
