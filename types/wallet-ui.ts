export interface WalletCardProps {
  title: string;
  amount: number;
}

export interface BalanceCardProps {
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
}

export interface TransactionRowProps {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
}

export interface WalletSummaryProps {
  totalDeposits: number;
  totalWithdrawals: number;
  totalWinnings: number;
}
