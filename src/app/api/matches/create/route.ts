import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { gameId, stake, isPublic, opponentId } = await req.json();

    if (!gameId || !stake || stake < 50) {
      return NextResponse.json({ error: 'Invalid match parameters' }, { status: 400 });
    }

    // Verify game exists
    const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (!game || !game.is_active) return NextResponse.json({ error: 'Game not available' }, { status: 400 });
    if (stake < game.min_stake || stake > game.max_stake) {
      return NextResponse.json({ error: `Stake must be between ${game.min_stake} and ${game.max_stake}` }, { status: 400 });
    }

    // Check balance
    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
    if (!wallet || wallet.available_balance < stake) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Create match
    const { data: match, error: matchError } = await supabase.from('matches').insert({
      game_id: gameId,
      creator_id: user.id,
      opponent_id: opponentId || null,
      stake,
      status: 'waiting',
      is_public: isPublic && !opponentId,
    }).select().single();

    if (matchError) throw matchError;

    // Add creator as participant
    await supabase.from('match_participants').insert({ match_id: match.id, user_id: user.id });

    // Lock creator's stake
    const newAvailable = wallet.available_balance - stake;
    const newLocked = wallet.locked_balance + stake;

    await supabase.from('wallets').update({
      available_balance: newAvailable,
      locked_balance: newLocked,
    }).eq('user_id', user.id);

    await supabase.from('wallet_ledger').insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: 'match_stake',
      amount: -stake,
      balance_after: newAvailable,
      reference_id: match.id,
      description: `Stake locked for ${game.name} match`,
    });

    // Notify opponent if challenge
    if (opponentId) {
      await supabase.from('notifications').insert({
        user_id: opponentId,
        title: 'Match Challenge!',
        message: `You have been challenged to a game of ${game.name} for ${stake.toLocaleString()} XAF.`,
        type: 'match_challenge',
        data: { match_id: match.id },
      });
    }

    return NextResponse.json({ success: true, matchId: match.id });
  } catch (error) {
    console.error('Create match error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
