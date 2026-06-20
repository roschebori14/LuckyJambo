'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';

interface WalletData {
  available_balance: number;
  locked_balance: number;
}

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export default function WalletPage() {
  const [tab, setTab] = useState<'overview' | 'deposit' | 'withdraw'>('overview');
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPhone, setDepositPhone] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadWallet() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: w }, { data: l }] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', user.id).single(),
        supabase.from('wallet_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      ]);

      setWallet(w);
      setLedger(l || []);
      setLoading(false);
    }
    loadWallet();
  }, []);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInt(depositAmount);
    if (amount < 50) return toast.error('Minimum deposit is 50 XAF');
    if (amount > 100000) return toast.error('Maximum deposit is 100,000 XAF');
    if (!depositPhone) return toast.error('Enter your Mobile Money number');

    setProcessing(true);
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, phone: depositPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deposit failed');

      if (data.payLink) {
        toast.success('Redirecting to payment...');
        window.location.href = data.payLink;
      } else {
        toast.success('Deposit initiated! Check your phone for the payment prompt.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setProcessing(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInt(withdrawAmount);
    if (amount < 500) return toast.error('Minimum withdrawal is 500 XAF');
    if (amount > 100000) return toast.error('Maximum withdrawal is 100,000 XAF');
    if (wallet && amount > wallet.available_balance) return toast.error('Insufficient balance');

    setProcessing(true);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, phone: withdrawPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      toast.success('Withdrawal request submitted. Admin will process within 24 hours.');
      setWithdrawAmount('');
      setWithdrawPhone('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setProcessing(false);
    }
  }

  const typeIcon: Record<string, string> = {
    deposit: '⬇️', withdrawal: '⬆️', match_stake: '🔒', match_win: '🏆', commission: '📊', refund: '↩️',
  };

  const typeColor: Record<string, string> = {
    deposit: 'text-green-400', withdrawal: 'text-red-400', match_stake: 'text-yellow-400',
    match_win: 'text-green-400', commission: 'text-gray-400', refund: 'text-blue-400',
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Loading wallet...</div></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-black">💰 Wallet</h1>

      {/* Balance overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Available Balance</div>
          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            {formatCurrency(wallet?.available_balance || 0)}
          </div>
        </div>
        <div className="card p-6">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Locked in Matches</div>
          <div className="text-3xl font-black text-yellow-400">{formatCurrency(wallet?.locked_balance || 0)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0d1b3e] p-1 rounded-lg w-fit">
        {(['overview', 'deposit', 'withdraw'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${tab === t ? 'gradient-primary text-white' : 'text-gray-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'deposit' && (
        <div className="card p-6 max-w-md">
          <h2 className="font-bold text-lg mb-6">Deposit via Mobile Money</h2>
          <form onSubmit={handleDeposit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Amount (XAF)</label>
              <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                placeholder="e.g. 1000" className="input-field" min="50" max="100000" required />
              <p className="text-xs text-gray-500 mt-1">Min: 50 XAF • Max: 100,000 XAF</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mobile Money Number</label>
              <input type="tel" value={depositPhone} onChange={e => setDepositPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX" className="input-field" required />
              <p className="text-xs text-gray-500 mt-1">MTN MoMo or Orange Money</p>
            </div>

            {depositAmount && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">You pay</span><span className="font-bold">{parseInt(depositAmount || '0').toLocaleString()} XAF</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-400">Credited to wallet</span><span className="font-bold text-green-400">{parseInt(depositAmount || '0').toLocaleString()} XAF</span></div>
              </div>
            )}

            <button type="submit" disabled={processing} className="btn-primary w-full disabled:opacity-60">
              {processing ? 'Processing...' : 'Deposit Now'}
            </button>
          </form>
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="card p-6 max-w-md">
          <h2 className="font-bold text-lg mb-6">Withdraw to Mobile Money</h2>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Amount (XAF)</label>
              <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="e.g. 2000" className="input-field" min="500" max={wallet?.available_balance || 0} required />
              <p className="text-xs text-gray-500 mt-1">
                Min: 500 XAF • Available: {formatCurrency(wallet?.available_balance || 0)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mobile Money Number</label>
              <input type="tel" value={withdrawPhone} onChange={e => setWithdrawPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX" className="input-field" required />
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-300">
              ⏳ Withdrawals are processed by our admin team within 24 hours.
            </div>
            <button type="submit" disabled={processing} className="btn-primary w-full disabled:opacity-60">
              {processing ? 'Submitting...' : 'Request Withdrawal'}
            </button>
          </form>
        </div>
      )}

      {tab === 'overview' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[#1e3a5f]">
            <h2 className="font-bold">Transaction History</h2>
          </div>
          {ledger.length > 0 ? (
            <div className="divide-y divide-[#1e3a5f]">
              {ledger.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{typeIcon[entry.type] || '💫'}</span>
                    <div>
                      <div className="text-sm font-medium">{entry.description}</div>
                      <div className="text-xs text-gray-500">{formatDate(entry.created_at)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${typeColor[entry.type] || 'text-white'}`}>
                      {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                    </div>
                    <div className="text-xs text-gray-500">Bal: {formatCurrency(entry.balance_after)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400">
              No transactions yet. Deposit to get started!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
