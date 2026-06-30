export type LedgerType =
  | "deposit"
  | "withdrawal"
  | "match_stake"
  | "match_win"
  | "match_loss"
  | "refund"
  | "bonus"
  | "admin_adjustment";

export interface LedgerEntry {
  id: string;
  wallet_id: string;
  user_id: string;
  type: LedgerType;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference: string | null;
  description?: string | null;
  created_at: string;
}

export interface CreateLedgerEntry {
  wallet_id: string;
  user_id: string;
  type: LedgerType;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference?: string | null;
  description?: string | null;
}
