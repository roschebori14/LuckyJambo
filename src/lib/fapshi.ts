const FAPSHI_BASE_URL = 'https://live.fapshi.com';

interface FapshiInitiateResponse {
  statusCode: number;
  message: string;
  payLink?: string;
  transId?: string;
}

interface FapshiStatusResponse {
  statusCode: number;
  message: string;
  data?: {
    amount: number;
    transId: string;
    status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'EXPIRED';
  };
}

interface FapshiPayoutResponse {
  statusCode: number;
  message: string;
  transId?: string;
}

export async function initiatePayment(
  amount: number,
  phone: string,
  externalId: string,
  redirectUrl: string,
  message: string = 'LuckyJambo Deposit'
): Promise<FapshiInitiateResponse> {
  const response = await fetch(`${FAPSHI_BASE_URL}/initiate-pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apiuser': process.env.FAPSHI_COLLECTION_KEY!,
      'apikey': process.env.FAPSHI_COLLECTION_SECRET!,
    },
    body: JSON.stringify({
      amount,
      phone,
      externalId,
      redirectUrl,
      message,
    }),
  });

  return response.json();
}

export async function checkPaymentStatus(transId: string): Promise<FapshiStatusResponse> {
  const response = await fetch(`${FAPSHI_BASE_URL}/payment-status/${transId}`, {
    headers: {
      'apiuser': process.env.FAPSHI_COLLECTION_KEY!,
      'apikey': process.env.FAPSHI_COLLECTION_SECRET!,
    },
  });

  return response.json();
}

export async function initiatePayout(
  amount: number,
  phone: string,
  externalId: string,
  message: string = 'LuckyJambo Withdrawal'
): Promise<FapshiPayoutResponse> {
  const response = await fetch(`${FAPSHI_BASE_URL}/payout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apiuser': process.env.FAPSHI_PAYOUT_KEY!,
      'apikey': process.env.FAPSHI_PAYOUT_SECRET!,
    },
    body: JSON.stringify({
      amount,
      phone,
      externalId,
      message,
    }),
  });

  return response.json();
}
