import { classifyStripeError } from '../stripePortal';

describe('classifyStripeError', () => {
  it('flags an unconfigured customer portal as 503 billing_portal_not_configured', () => {
    const err = new Error(
      'No configuration provided and your test mode default configuration has not been created.',
    );
    expect(classifyStripeError(err)).toEqual({ error: 'billing_portal_not_configured', status: 503 });
  });

  it('flags a missing/again unknown customer as 400 no_customer', () => {
    expect(classifyStripeError(new Error('No such customer: cus_123'))).toEqual({
      error: 'no_customer', status: 400,
    });
    expect(classifyStripeError({ code: 'resource_missing', message: 'x' })).toEqual({
      error: 'no_customer', status: 400,
    });
  });

  it('falls back to 502 portal_unavailable for anything else', () => {
    expect(classifyStripeError(new Error('connection reset'))).toEqual({
      error: 'portal_unavailable', status: 502,
    });
    expect(classifyStripeError('weird string')).toEqual({ error: 'portal_unavailable', status: 502 });
  });
});
