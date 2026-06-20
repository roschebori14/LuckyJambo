import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkPaymentStatus } from '@/lib/fapshi';
import { sendDepositSuccessEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transId, externalId, status } = body;

    if (!transId) return NextResponse.json({ error: 'Missing transId' }, { status: 400 });

    // Use admin client (bypasses RLS)
    const supabase = await createAdminClient();

    // Find deposit by external_id or fapshi_ref
    const { data: deposit } = await supabase
      .from('deposits')
      .select('*, profile:profiles(email, username)')
      .or(`external_id.eq.${externalId},fapshi_ref.eq.${transId}`)
      .single();

    if (!deposit) {
      console.log('Deposit not found for transId:', transId);
      return NextResponse.json({ ok: true }); // Don't error, Fapshi may retry
    }

    // Prevent duplicate processing
    if (deposit.status === 'completed') {
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    // Verify with Fapshi
    const fapshiStatus = await checkPaymentStatus(transId);
    const paymentSuccessful = fapshiStatus.data?.status === 'SUCCESSFUL' || status === 'SUCCESSFUL';

    if (paymentSuccessful) {
      const amount = deposit.amount;

      // Get wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, available_balance')
        .eq('user_id', deposit.user_id)
        .single();

      if (!wallet) throw new Error('Wallet not found');

      const newBalance = wallet.available_balance + amount;

      // Update wallet
      await supabase
        .from('wallets')
        .update({ available_balance: newBalance })
        .eq('user_id', deposit.user_id);

      // Create ledger entry
      await supabase.from('wallet_ledger').insert({
        wallet_id: wallet.id,
        user_id: deposit.user_id,
        type: 'deposit',
        amount: amount,
        balance_after: newBalance,
        reference_id: deposit.id,
        description: `Deposit via Mobile Money`,
      });

      // Mark deposit completed
      await supabase.from('deposits').update({ status: 'completed', fapshi_ref: transId }).eq('id', deposit.id);

      // Send notification
      await supabase.from('notifications').insert({
        user_id: deposit.user_id,
        title: 'Deposit Successful',
        message: `${amount.toLocaleString()} XAF has been added to your wallet.`,
        type: 'deposit',
      });

      // Send email
      try {
        const profile = Array.isArray(deposit.profile) ? deposit.profile[0] : deposit.profile;
        if (profile?.email) {
          await sendDepositSuccessEmail(profile.email, profile.username, amount);
        }
      } catch (emailError) {
        console.error('Email error:', emailError);
      }
    } else {
      await supabase.from('deposits').update({ status: 'failed' }).eq('id', deposit.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
