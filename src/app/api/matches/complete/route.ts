import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateWinnings } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { matchId, winnerId } = await req.json();

    const { data: match } = await supabase.from('matches')
      .select('*, game:games(name)')
      .eq('id', matchId).single();

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.status !== 'active') return NextResponse.json({ error: 'Match not active' }, { status: 400 });
    if (match.creator_id !== user.id && match.opponent_id !== user.id) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }
    if (winnerId !== match.creator_id && winnerId !== match.opponent_id) {
      return NextResponse.json({ error: 'Invalid winner' }, { status: 400 });
    }

    const loserId = winnerId === match.creator_id ? match.opponent_id : match.creator_id;
    const { winnerReceives, fee } = calculateWinnings(match.stake);

    await supabase.from('matches').update({
      status: 'completed', winner_id: winnerId,
      completed_at: new Date().toISOString(),
    }).eq('id', matchId);

    // Credit winner
    const { data: winnerWallet } = await supabase.from('wallets').select('*').eq('user_id', winnerId).single();
    if (winnerWallet) {
      const newAvailable = winnerWallet.available_balance + winnerReceives;
      const newLocked = Math.max(0, winnerWallet.locked_balance - match.stake);
      await supabase.from('wallets').update({ available_balance: newAvailable, locked_balance: newLocked }).eq('user_id', winnerId);
      await supabase.from('wallet_ledger').insert({
        wallet_id: winnerWallet.id, user_id: winnerId, type: 'match_win',
        amount: winnerReceives, balance_after: newAvailable,
        reference_id: matchId, description: `Won ${match.game?.name} match`,
      });
    }

    // Deduct loser locked stake
    const { data: loserWallet } = await supabase.from('wallets').select('*').eq('user_id', loserId).single();
    if (loserWallet) {
      const newLocked = Math.max(0, loserWallet.locked_balance - match.stake);
      await supabase.from('wallets').update({ locked_balance: newLocked }).eq('user_id', loserId);
    }

    // Notifications
    await supabase.from('notifications').insert([
      { user_id: winnerId, title: '🏆 You Won!', message: `You won ${winnerReceives.toLocaleString()} XAF in ${match.game?.name}!`, type: 'match_win', data: { match_id: matchId } },
      { user_id: loserId, title: 'Match Lost', message: `You lost the ${match.game?.name} match. Better luck next time!`, type: 'match_loss', data: { match_id: matchId } },
    ]);

    return NextResponse.json({ success: true, winnerReceives, fee });
  } catch (error) {
    console.error('Complete match error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
