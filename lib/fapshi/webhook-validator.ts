/**
 * Fapshi doesn't cryptographically sign webhook payloads, so this can
 * only do a basic shape check - it is NOT proof the request actually
 * came from Fapshi. The webhook route treats this as a cheap early
 * filter only; the real authenticity check is re-querying Fapshi's
 * own payment-status endpoint for the transId before crediting
 * anything (see getFapshiPaymentStatus + app/api/fapshi/webhook).
 *
 * If FAPSHI_WEBHOOK_SECRET is configured and the webhook URL registered
 * with Fapshi includes it as a `?secret=` query param, this also checks
 * that as a lightweight extra filter against random/scanner traffic.
 */
export function validateWebhook(
  payload: unknown,
  providedSecret?: string | null,
): payload is { transId: string; status: string; amount: number; externalId?: string } {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.transId !== "string" || !p.transId) {
    return false;
  }
  if (typeof p.status !== "string" || !p.status) {
    return false;
  }

  const expectedSecret = process.env.FAPSHI_WEBHOOK_SECRET;
  if (expectedSecret && providedSecret !== expectedSecret) {
    return false;
  }

  return true;
}
