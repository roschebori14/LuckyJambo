export type DepositStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

export interface Deposit {
  id: string;

  user_id: string;

  amount: number;

  status: DepositStatus;

  payment_reference: string;

  provider_transaction_id?: string;

  payment_link?: string;

  provider: "fapshi";

  created_at: string;

  updated_at: string;
}

export interface CreateDepositRequest {
  amount: number;
}

export interface CreateDepositResponse {
  success: boolean;

  paymentLink?: string;

  reference?: string;

  message: string;
}
