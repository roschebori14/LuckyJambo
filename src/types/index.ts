export type UserRole = 'user' | 'admin';
export type DepositStatus = 'pending' | 'completed' | 'failed';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'failed' | 'completed';
export type MatchStatus = 'waiting' | 'active' | 'completed' | 'cancelled';
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';
export type GameType = 'chess' | 'draughts' | 'tictactoe' | 'dice' | 'coinflip';
export type TransactionType = 'deposit' | 'withdrawal' | 'match_stake' | 'match_win' | 'commission' | 'refund';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  available_balance: number;
  locked_balance: number;
  updated_at: string;
}

export interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  phone: string;
  fapshi_ref?: string;
  status: DepositStatus;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  phone: string;
  fapshi_ref?: string;
  status: WithdrawalStatus;
  admin_note?: string;
  created_at: string;
}

export interface Game {
  id: string;
  name: string;
  type: GameType;
  description: string;
  min_stake: number;
  max_stake: number;
  is_active: boolean;
  image_url?: string;
}

export interface Match {
  id: string;
  game_id: string;
  game?: Game;
  creator_id: string;
  opponent_id?: string;
  stake: number;
  status: MatchStatus;
  winner_id?: string;
  game_state?: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
  participants?: MatchParticipant[];
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  user_id: string;
  profile?: Profile;
  is_ready: boolean;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender?: Profile;
  receiver?: Profile;
  status: FriendRequestStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
}

export interface WalletLedger {
  id: string;
  wallet_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  reference_id?: string;
  description: string;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  total_deposits: number;
  total_withdrawals: number;
  revenue: number;
  matches_played: number;
  pending_withdrawals: number;
}
