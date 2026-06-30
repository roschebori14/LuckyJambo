export type TransactionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "failed"
  | "completed";

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "match_stake"
  | "match_win"
  | "match_loss"
  | "refund"
  | "bonus";

export interface Deposit {
  id: string;

  user_id: string;

  amount: number;

  provider: string;

  transaction_reference: string;

  status: TransactionStatus;

  created_at: string;
}

export interface Withdrawal {
  id: string;

  user_id: string;

  amount: number;

  account_number: string;

  provider: string;

  transaction_reference: string | null;

  status: TransactionStatus;

  created_at: string;
}

export interface Transaction {
  id: string;

  user_id: string;

  amount: number;

  transaction_type: TransactionType;

  reference: string;

  status: TransactionStatus;

  created_at: string;
}

export interface FapshiPaymentReference {
  transaction_id: string;

  external_reference: string;

  amount: number;

  status: TransactionStatus;
}

export interface PaymentRequest {
  amount: number;

  phone_number: string;

  external_reference: string;
}

export interface PaymentResponse {
  success: boolean;

  transaction_reference: string;

  message: string;
}
