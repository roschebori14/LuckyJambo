const DEFAULT_FAPSHI_BASE_URL = "https://sandbox.fapshi.com";

interface FapshiConfig {
  baseUrl: string;
  apiUser: string;
  apiKey: string;
}

export interface InitiatePayInput {
  amount: number;
  email?: string;
  redirectUrl?: string;
  userId: string;
  externalId: string;
  message: string;
}

export interface InitiatePayResponse {
  message: string;
  link: string;
  transId: string;
  dateInitiated: string;
}

function getCollectionConfig(): FapshiConfig {
  const apiUser = process.env.FAPSHI_COLLECTION_API_USER ?? process.env.FAPSHI_COLLECTION_API_KEY;
  const apiKey =
    process.env.FAPSHI_COLLECTION_API_SECRET ?? process.env.FAPSHI_COLLECTION_API_KEY_SECRET;

  if (!apiUser || !apiKey) {
    throw new Error("Missing Fapshi collection credentials");
  }

  return {
    baseUrl: process.env.FAPSHI_BASE_URL ?? DEFAULT_FAPSHI_BASE_URL,
    apiUser,
    apiKey,
  };
}

async function requestFapshi<T>(
  path: string,
  body: Record<string, unknown>,
  config: FapshiConfig,
): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiuser: config.apiUser,
      apikey: config.apiKey,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof responseBody.message === "string"
        ? responseBody.message
        : "Fapshi request failed";

    throw new Error(message);
  }

  return responseBody as T;
}

async function getFapshi<T>(path: string, config: FapshiConfig): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "GET",
    headers: {
      apiuser: config.apiUser,
      apikey: config.apiKey,
    },
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof responseBody.message === "string"
        ? responseBody.message
        : "Fapshi request failed";

    throw new Error(message);
  }

  return responseBody as T;
}

export interface FapshiStatusResponse {
  transId: string;
  status: "CREATED" | "PENDING" | "SUCCESSFUL" | "FAILED" | "EXPIRED" | string;
  amount: number;
  externalId?: string;
  medium?: string;
  dateInitiated?: string;
  dateConfirmed?: string;
}

/**
 * Confirms a payment's real status directly with Fapshi, rather than
 * trusting whatever a webhook payload or redirect query string claims.
 * Fapshi doesn't sign webhook payloads, so this server-to-server check
 * is what actually proves a deposit was paid before we credit a
 * wallet - the webhook/complete routes use this as the source of
 * truth, not the incoming payload's "status" field.
 */
export async function getFapshiPaymentStatus(transId: string) {
  const config = getCollectionConfig();
  return getFapshi<FapshiStatusResponse>(`/payment-status/${transId}`, config);
}

export async function initiateFapshiPayment(input: InitiatePayInput) {
  const config = getCollectionConfig();

  return requestFapshi<InitiatePayResponse>(
    "/initiate-pay",
    {
      amount: Math.round(input.amount),
      ...(input.email ? { email: input.email } : {}),
      ...(input.redirectUrl ? { redirectUrl: input.redirectUrl } : {}),
      userId: input.userId,
      externalId: input.externalId,
      message: input.message,
    },
    config,
  );
}

function getPayoutConfig(): FapshiConfig {
  const apiUser = process.env.FAPSHI_PAYOUT_API_KEY;
  const apiKey = process.env.FAPSHI_PAYOUT_API_SECRET;

  if (!apiUser || !apiKey) {
    throw new Error("Missing Fapshi payout credentials");
  }

  return {
    baseUrl: process.env.FAPSHI_BASE_URL ?? DEFAULT_FAPSHI_BASE_URL,
    apiUser,
    apiKey,
  };
}

export interface PayoutInput {
  amount: number;
  phone: string;
  medium: "mobile money" | "orange money";
  userId: string;
  externalId: string;
  message: string;
}

export interface PayoutResponse {
  transId: string;
  message: string;
}

export async function initiateFapshiPayout(input: PayoutInput) {
  const config = getPayoutConfig();

  return requestFapshi<PayoutResponse>(
    "/payout",
    {
      amount: Math.round(input.amount),
      phone: input.phone,
      medium: input.medium,
      userId: input.userId,
      externalId: input.externalId,
      message: input.message,
    },
    config,
  );
}

