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
