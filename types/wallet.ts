export interface Wallet {
  id: string;
  user_id: string;

  available_balance: number;
  locked_balance: number;

  created_at: string;
  updated_at: string;
}

export interface WalletBalance {
  available_balance: number;
  locked_balance: number;

  total_balance: number;
}

export interface WalletSummary {
  wallet: Wallet;

  total_deposits: number;
  total_withdrawals: number;

  total_winnings: number;
  total_losses: number;

  total_matches: number;
}

export interface WalletAdjustment {
  amount: number;
  reason: string;
  reference?: string;
}

export type WalletTransactionType =
  | "deposit"
  | "withdrawal"
  | "match_stake"
  | "match_win"
  | "match_loss"
  | "refund"
  | "bonus"
  | "admin_adjustment";
