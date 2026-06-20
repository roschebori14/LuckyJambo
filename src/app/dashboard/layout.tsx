import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/games', label: 'Games', icon: '🎮' },
  { href: '/matches', label: 'Matches', icon: '⚔️' },
  { href: '/friends', label: 'Friends', icon: '👥' },
  { href: '/wallet', label: 'Wallet', icon: '💰' },
  { href: '/profile', label: 'Profile', icon: '👤' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_read', false);

  const unreadCount = notifications?.length || 0;

  return (
    <div className="min-h-screen bg-[#030712] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#1e3a5f] bg-[#0d1b3e]/50 fixed h-full z-40">
        <div className="p-6 border-b border-[#1e3a5f]">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-black text-sm">LJ</div>
            <span className="font-black text-lg">LUCKY <span className="text-[#00c6ff]">JAMBO</span></span>
          </Link>
        </div>

        {/* Balance */}
        <div className="p-4 mx-4 mt-4 card rounded-xl">
          <div className="text-xs text-gray-500 mb-1">Available Balance</div>
          <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            {((wallet?.available_balance || 0)).toLocaleString()} XAF
          </div>
          {wallet?.locked_balance ? (
            <div className="text-xs text-gray-500 mt-1">{wallet.locked_balance.toLocaleString()} XAF locked</div>
          ) : null}
          <Link href="/wallet" className="mt-3 btn-primary text-xs py-2 px-4 inline-block text-center w-full">Deposit</Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 mt-2">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-150 text-sm font-medium"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {profile?.role === 'admin' && (
            <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-lg text-yellow-400 hover:bg-yellow-500/10 transition-all text-sm font-medium mt-4">
              <span>⚙️</span> Admin Panel
            </Link>
          )}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-[#1e3a5f]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center font-black text-sm">
              {profile?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profile?.username || 'User'}</div>
              <div className="text-xs text-gray-500 truncate">{user.email}</div>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-gray-500 hover:text-red-400 text-xs transition-colors">
                Exit
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0d1b3e]/90 backdrop-blur-md border-b border-[#1e3a5f] h-14 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center font-black text-xs">LJ</div>
          <span className="font-black text-sm">LUCKY <span className="text-[#00c6ff]">JAMBO</span></span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{((wallet?.available_balance || 0)).toLocaleString()} XAF</span>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d1b3e]/90 backdrop-blur-md border-t border-[#1e3a5f] flex">
        {navItems.slice(0, 5).map(item => (
          <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center py-2 text-gray-400 hover:text-white transition-colors">
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Main content */}
      <main className="md:ml-64 flex-1 min-h-screen pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
