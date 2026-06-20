import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateWinnings } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { matchId, move, newGameState, winnerId } = await req.json();

    const { data: match } = await supabase.from('matches')
      .select('*, game:games(name)')
      .eq('id', matchId).single();

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (match.status !== 'active') return NextResponse.json({ error: 'Match not active' }, { status: 400 });
    if (match.creator_id !== user.id && match.opponent_id !== user.id) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    // If there's a winner, complete the match
    if (winnerId) {
      const loserId = winnerId === match.creator_id ? match.opponent_id : match.creator_id;
      const { winnerReceives } = calculateWinnings(match.stake);

      await supabase.from('matches').update({
        status: 'completed',
        winner_id: winnerId,
        game_state: newGameState,
        completed_at: new Date().toISOString(),
      }).eq('id', matchId);

      // Credit winner
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
          description: `Won ${match.game?.name} match`,
        });
      }

      // Release loser's locked stake
      const { data: loserWallet } = await supabase.from('wallets').select('*').eq('user_id', loserId).single();
      if (loserWallet) {
        const newLocked = Math.max(0, loserWallet.locked_balance - match.stake);
        await supabase.from('wallets').update({ locked_balance: newLocked }).eq('user_id', loserId);
        await supabase.from('wallet_ledger').insert({
          wallet_id: loserWallet.id,
          user_id: loserId,
          type: 'match_stake',
          amount: 0,
          balance_after: loserWallet.available_balance,
          reference_id: matchId,
          description: `Lost ${match.game?.name} match`,
        });
      }

      // Notifications
      await supabase.from('notifications').insert([
        {
          user_id: winnerId,
          title: '🏆 Match Won!',
          message: `You won ${winnerReceives.toLocaleString()} XAF from the ${match.game?.name} match!`,
          type: 'match_win',
          data: { match_id: matchId },
        },
        {
          user_id: loserId,
          title: 'Match Ended',
          message: `You lost the ${match.game?.name} match. Better luck next time!`,
          type: 'match_loss',
          data: { match_id: matchId },
        },
      ]);

      return NextResponse.json({ success: true, completed: true });
    }

    // If draw, refund both
    if (newGameState?.isDraw) {
      await supabase.from('matches').update({
        status: 'completed',
        game_state: newGameState,
        completed_at: new Date().toISOString(),
      }).eq('id', matchId);

      for (const pid of [match.creator_id, match.opponent_id]) {
        const { data: w } = await supabase.from('wallets').select('*').eq('user_id', pid).single();
        if (w) {
          const newAvailable = w.available_balance + match.stake;
          const newLocked = Math.max(0, w.locked_balance - match.stake);
          await supabase.from('wallets').update({ available_balance: newAvailable, locked_balance: newLocked }).eq('user_id', pid);
          await supabase.from('wallet_ledger').insert({
            wallet_id: w.id, user_id: pid, type: 'refund',
            amount: match.stake, balance_after: newAvailable,
            reference_id: matchId, description: `Draw refund for ${match.game?.name}`,
          });
        }
      }
      return NextResponse.json({ success: true, completed: true, draw: true });
    }

    // Just update game state (move made)
    await supabase.from('matches').update({ game_state: newGameState }).eq('id', matchId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Move error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
