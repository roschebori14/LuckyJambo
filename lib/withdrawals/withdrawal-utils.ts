export function generateWithdrawalReference() {
  return `WD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function formatWithdrawalAmount(amount: number) {
  return amount.toLocaleString("en-US");
}

export function sanitizePhoneNumber(phone: string) {
  return phone.replace(/\s/g, "");
}
