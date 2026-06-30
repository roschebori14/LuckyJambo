export class WalletError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "WalletError";
  }
}

export class InsufficientBalanceError extends WalletError {
  constructor() {
    super("Insufficient balance");
  }
}

export class InvalidAmountError extends WalletError {
  constructor() {
    super("Invalid amount");
  }
}

export class WalletNotFoundError extends WalletError {
  constructor() {
    super("Wallet not found");
  }
}

export class LedgerError extends WalletError {
  constructor() {
    super("Ledger operation failed");
  }
}
