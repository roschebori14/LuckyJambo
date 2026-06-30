export function validateWebhook(payload: unknown) {
  if (!payload) {
    return false;
  }

  return true;
}
