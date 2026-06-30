import { Wallet } from "@/types/wallet";

export class BalanceEngine {
  static calculateTotalBalance(wallet: Wallet): number {
    return wallet.available_balance + wallet.locked_balance;
  }

  static canAfford(wallet: Wallet, amount: number): boolean {
    return wallet.available_balance >= amount;
  }

  static lockFunds(wallet: Wallet, amount: number): Wallet {
    return {
      ...wallet,
      available_balance: wallet.available_balance - amount,
      locked_balance: wallet.locked_balance + amount,
    };
  }

  static unlockFunds(wallet: Wallet, amount: number): Wallet {
    return {
      ...wallet,
      available_balance: wallet.available_balance + amount,
      locked_balance: wallet.locked_balance - amount,
    };
  }

  static credit(wallet: Wallet, amount: number): Wallet {
    return {
      ...wallet,
      available_balance: wallet.available_balance + amount,
    };
  }

  static debit(wallet: Wallet, amount: number): Wallet {
    return {
      ...wallet,
      available_balance: wallet.available_balance - amount,
    };
  }
}
