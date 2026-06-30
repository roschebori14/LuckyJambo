export interface FraudResult {
  userId: string;
  score: number;
  reason: string;
}

export async function scanUser(userId: string): Promise<FraudResult[]> {
  const alerts: FraudResult[] = [];

  return alerts;
}

export function calculateRiskScore(deposits: number, withdrawals: number) {
  let score = 0;

  if (withdrawals > deposits * 2) {
    score += 50;
  }

  return score;
}
