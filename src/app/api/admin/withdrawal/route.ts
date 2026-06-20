import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { initiatePayout } from '@/lib/fapshi';
import { sendWithdrawalApprovedEmail, sendWithdrawalRejectedEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { withdrawalId, action, note } = await req.json();
    if (!['approved', 'rejected'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const adminClient = await createAdminClient();
    const { data: withdrawal } = await adminClient
      .from('withdrawals')
      .select('*, profile:profiles(email, username)')
      .eq('id', withdrawalId).single();

    if (!withdrawal) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    if (withdrawal.status !== 'pending') return NextResponse.json({ error: 'Already processed' }, { status: 400 });

    const profile = Array.isArray(withdrawal.profile) ? withdrawal.profile[0] : withdrawal.profile;

    if (action === 'approved') {
      // Initiate payout via Fapshi
      let fapshiRef: string | undefined;
      try {
        const payoutRes = await initiatePayout(
          withdrawal.amount,
          withdrawal.phone,
          withdrawalId,
          `LuckyJambo withdrawal for @${profile?.username}`
        );
        if (payoutRes.statusCode === 200) {
          fapshiRef = payoutRes.transId;
        }
      } catch (e) {
        console.error('Fapshi payout error:', e);
        // Continue with manual approval even if Fapshi fails
      }

      await adminClient.from('withdrawals').update({
        status: 'completed',
        fapshi_ref: fapshiRef || null,
        admin_id: user.id,
        admin_note: note || 'Approved',
      }).eq('id', withdrawalId);

      // Notify user
      await adminClient.from('notifications').insert({
        user_id: withdrawal.user_id,
        title: '✅ Withdrawal Approved',
        message: `Your withdrawal of ${withdrawal.amount.toLocaleString()} XAF has been approved and sent.`,
        type: 'withdrawal_approved',
        data: { withdrawal_id: withdrawalId },
      });

      // Send email
      if (profile?.email) {
        await sendWithdrawalApprovedEmail(profile.email, profile.username, withdrawal.amount).catch(console.error);
      }

    } else {
      // Rejected — refund to available balance
      const { data: wallet } = await adminClient.from('wallets').select('*').eq('user_id', withdrawal.user_id).single();
      if (wallet) {
        const newAvailable = wallet.available_balance + withdrawal.amount;
        await adminClient.from('wallets').update({ available_balance: newAvailable }).eq('user_id', withdrawal.user_id);
        await adminClient.from('wallet_ledger').insert({
          wallet_id: wallet.id,
          user_id: withdrawal.user_id,
          type: 'refund',
          amount: withdrawal.amount,
          balance_after: newAvailable,
          reference_id: withdrawalId,
          description: `Withdrawal refunded – ${note || 'Rejected by admin'}`,
        });
      }

      await adminClient.from('withdrawals').update({
        status: 'rejected',
        admin_id: user.id,
        admin_note: note || 'Rejected',
      }).eq('id', withdrawalId);

      await adminClient.from('notifications').insert({
        user_id: withdrawal.user_id,
        title: '❌ Withdrawal Rejected',
        message: `Your withdrawal was rejected. Funds returned to wallet. Reason: ${note || 'Not specified'}`,
        type: 'withdrawal_rejected',
        data: { withdrawal_id: withdrawalId },
      });

      if (profile?.email) {
        await sendWithdrawalRejectedEmail(profile.email, profile.username, withdrawal.amount, note).catch(console.error);
      }
    }

    // Log admin action
    await adminClient.from('admin_logs').insert({
      admin_id: user.id,
      action: `withdrawal_${action}`,
      target_id: withdrawalId,
      target_type: 'withdrawal',
      details: { amount: withdrawal.amount, note },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin withdrawal error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
