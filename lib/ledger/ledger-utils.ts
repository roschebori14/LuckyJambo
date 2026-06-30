export function generateLedgerReference() {
  return `LEDGER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function formatLedgerAmount(amount: number) {
  return amount.toLocaleString();
}

export function isCredit(amount: number) {
  return amount > 0;
}

export function isDebit(amount: number) {
  return amount < 0;
}
