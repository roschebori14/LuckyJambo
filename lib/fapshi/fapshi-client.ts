// Fapshi API client. Endpoints confirmed against docs.fapshi.com:
//   POST /initiate-pay       - create a hosted payment link (deposits)
//   GET  /payment-status/:id - check a transaction's current status
//   POST /payout             - send money to a phone (withdrawals)
//
// Fapshi requires SEPARATE services (and therefore separate API
// credentials) for collection vs payout - "After enabling payouts for
// a service, that service can no longer collect payments." So this
// client deliberately keeps two credential sets rather than one.

const DEFAULT_BASE_URL = "https://sandbox.fapshi.com";

interface FapshiCredentials {
  apiUser: string;
  apiKey: string;
}

function getBaseUrl(): string {
  return process.env.FAPSHI_BASE_URL ?? DEFAULT_BASE_URL;
}

function getCollectionCredentials(): FapshiCredentials {
  const apiUser = process.env.FAPSHI_COLLECTION_API_USER;
  const apiKey = process.env.FAPSHI_COLLECTION_API_KEY;
  if (!apiUser || !apiKey) throw new Error("Missing Fapshi collection credentials");
  return { apiUser, apiKey };
}

function getPayoutCredentials(): FapshiCredentials {
  const apiUser = process.env.FAPSHI_PAYOUT_API_USER;
  const apiKey = process.env.FAPSHI_PAYOUT_API_KEY;
  if (!apiUser || !apiKey) throw new Error("Missing Fapshi payout credentials");
  return { apiUser, apiKey };
}

async function fapshiRequest<T>(
  method: "GET" | "POST",
  path: string,
  creds: FapshiCredentials,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apiuser: creds.apiUser,
      apikey: creds.apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.message === "string" ? json.message : `Fapshi request failed (${res.status})`);
  }
  return json as T;
}

// ── Collection (deposits) ──────────────────────────────────────────

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

export async function initiatePay(input: InitiatePayInput): Promise<InitiatePayResponse> {
  return fapshiRequest<InitiatePayResponse>("POST", "/initiate-pay", getCollectionCredentials(), {
    amount: Math.round(input.amount),
    ...(input.email ? { email: input.email } : {}),
    ...(input.redirectUrl ? { redirectUrl: input.redirectUrl } : {}),
    userId: input.userId,
    externalId: input.externalId,
    message: input.message,
  });
}

export type FapshiTxStatus = "CREATED" | "PENDING" | "SUCCESSFUL" | "FAILED" | "EXPIRED";

export interface PaymentStatusResponse {
  transId: string;
  status: FapshiTxStatus;
  medium: string;
  serviceName: string;
  amount: number;
  revenue: number;
  payerName?: string;
  email?: string;
  externalId?: string;
  userId?: string;
  financialTransId?: string;
  dateInitiated: string;
  dateConfirmed?: string;
}

/**
 * Authoritative status check. Fapshi's webhook payload is NOT signed
 * (no HMAC secret in their docs), so we never trust the webhook body
 * directly - we use the transId it gives us to re-fetch status here,
 * server-to-server with our own credentials, before crediting anyone.
 */
export async function getPaymentStatus(transId: string): Promise<PaymentStatusResponse> {
  return fapshiRequest<PaymentStatusResponse>(
    "GET",
    `/payment-status/${encodeURIComponent(transId)}`,
    getCollectionCredentials(),
  );
}

// ── Payout (withdrawals) ────────────────────────────────────────────

export interface PayoutInput {
  amount: number;
  phone: string;
  medium: "mobile money" | "orange money";
  name?: string;
  userId: string;
  externalId: string;
  message: string;
}

export interface PayoutResponse {
  message: string;
  transId: string;
  dateInitiated: string;
}

export async function sendPayout(input: PayoutInput): Promise<PayoutResponse> {
  return fapshiRequest<PayoutResponse>("POST", "/payout", getPayoutCredentials(), {
    amount: Math.round(input.amount),
    phone: input.phone,
    medium: input.medium,
    ...(input.name ? { name: input.name } : {}),
    userId: input.userId,
    externalId: input.externalId,
    message: input.message,
  });
}

/**
 * Same idempotent status check, but using payout credentials, since
 * Fapshi payout transactions live under the payout service.
 */
export async function getPayoutStatus(transId: string): Promise<PaymentStatusResponse> {
  return fapshiRequest<PaymentStatusResponse>(
    "GET",
    `/payment-status/${encodeURIComponent(transId)}`,
    getPayoutCredentials(),
  );
}
