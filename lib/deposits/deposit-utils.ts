export function generateDepositReference() {
  return `DEP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function formatAmount(amount: number) {
  return amount.toLocaleString("en-US");
}

export function isValidAmount(amount: number) {
  return amount >= 50;
}
