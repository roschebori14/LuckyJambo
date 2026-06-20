import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, phone } = await req.json();

    if (!amount || amount < 500 || amount > 100000) {
      return NextResponse.json({ error: 'Invalid amount. Min 500, max 100,000 XAF.' }, { status: 400 });
    }

    // Check balance server-side
    const { data: wallet } = await supabase
      .from('wallets')
      .select('available_balance')
      .eq('user_id', user.id)
      .single();

    if (!wallet || wallet.available_balance < amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Create withdrawal request
    const { data: withdrawal, error } = await supabase
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount,
        phone,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Reserve the funds (deduct from available)
    const { error: walletError } = await supabase.rpc('deduct_available_balance', {
      p_user_id: user.id,
      p_amount: amount,
    });

    // If RPC not available, do it manually with ledger
    if (walletError) {
      // Fallback: update wallet directly
      await supabase
        .from('wallets')
        .update({ available_balance: wallet.available_balance - amount })
        .eq('user_id', user.id);

      await supabase.from('wallet_ledger').insert({
        wallet_id: (await supabase.from('wallets').select('id').eq('user_id', user.id).single()).data?.id,
        user_id: user.id,
        type: 'withdrawal',
        amount: -amount,
        balance_after: wallet.available_balance - amount,
        reference_id: withdrawal.id,
        description: `Withdrawal request - ${phone}`,
      });
    }

    return NextResponse.json({ success: true, withdrawalId: withdrawal.id });
  } catch (error) {
    console.error('Withdrawal error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
