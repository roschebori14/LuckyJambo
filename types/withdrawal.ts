export type WithdrawalStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed";

export interface Withdrawal {
  id: string;

  user_id: string;

  amount: number;

  phone_number: string;

  provider: "mtn" | "orange";

  status: WithdrawalStatus;

  reference: string;

  created_at: string;

  updated_at: string;
}

export interface CreateWithdrawalRequest {
  amount: number;

  phone_number: string;

  provider: "mtn" | "orange";
}

export interface CreateWithdrawalResponse {
  success: boolean;

  message: string;

  withdrawal?: Withdrawal;
}
