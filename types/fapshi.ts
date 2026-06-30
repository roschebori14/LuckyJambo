export interface InitiatePaymentRequest {
  amount: number;

  email?: string;

  userId: string;

  reference: string;
}

export interface InitiatePaymentResponse {
  payment_url: string;

  transId: string;
}

export interface FapshiWebhookPayload {
  transId: string;

  amount: number;

  status: string;

  externalId?: string;
}
