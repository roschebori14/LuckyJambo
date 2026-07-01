export interface FapshiPayment {
  transId: string;

  amount: number;

  status: string;

  payment_url?: string;
}

export interface FapshiVerification {
  success: boolean;

  status: string;
}
