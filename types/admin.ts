export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalRevenue: number;
  totalMatches: number;
  pendingWithdrawals: number;
}

export interface FraudAlert {
  id: string;
  userId: string;
  reason: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  isBanned: boolean;
  createdAt: string;
}

export interface DepositRecord {
  id: string;
  userId: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface MatchRecord {
  id: string;
  gameId: string;
  stake: number;
  status: string;
  createdAt: string;
}
