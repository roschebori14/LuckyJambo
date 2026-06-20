import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initiatePayment } from '@/lib/fapshi';
import { generateReferenceId } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, phone } = await req.json();

    // Server-side validation
    if (!amount || amount < 50 || amount > 100000) {
      return NextResponse.json({ error: 'Invalid amount. Min 50, max 100,000 XAF.' }, { status: 400 });
    }
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const externalId = generateReferenceId();
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=success`;

    // Create pending deposit record FIRST
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert({
        user_id: user.id,
        amount,
        phone,
        external_id: externalId,
        status: 'pending',
      })
      .select()
      .single();

    if (depositError) throw depositError;

    // Initiate Fapshi payment
    const fapshiRes = await initiatePayment(amount, phone, externalId, redirectUrl);

    if (fapshiRes.statusCode !== 200) {
      // Mark deposit as failed
      await supabase.from('deposits').update({ status: 'failed' }).eq('id', deposit.id);
      return NextResponse.json({ error: fapshiRes.message || 'Payment initiation failed' }, { status: 400 });
    }

    // Update deposit with fapshi ref
    await supabase.from('deposits').update({ fapshi_ref: fapshiRes.transId }).eq('id', deposit.id);

    return NextResponse.json({ 
      success: true, 
      payLink: fapshiRes.payLink,
      transId: fapshiRes.transId,
      depositId: deposit.id,
    });
  } catch (error) {
    console.error('Deposit error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
