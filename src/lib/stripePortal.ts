/**
 * Map a thrown Stripe (or unknown) error from billingPortal.sessions.create
 * into a stable { error code, HTTP status } pair. The code is for logs/tests;
 * the client shows one generic message regardless.
 */
export function classifyStripeError(err: unknown): { error: string; status: number } {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : typeof err === 'string'
        ? err
        : '';
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';

  if (/no configuration provided|customer portal|billing portal/i.test(msg)) {
    return { error: 'billing_portal_not_configured', status: 503 };
  }
  if (code === 'resource_missing' || /no such customer/i.test(msg)) {
    return { error: 'no_customer', status: 400 };
  }
  return { error: 'portal_unavailable', status: 502 };
}
