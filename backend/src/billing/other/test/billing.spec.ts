import { subscriptionState, sandboxPeriodEnd } from '../catalog';
import { verifyBillingSignature } from '../signature';
import { createHmac } from 'node:crypto';
describe('billing time and authentication boundaries', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const paid = {
    plan: 'premium',
    status: 'active',
    trialEndsAt: null,
    periodEnd: new Date(now.getTime() + 1000),
    graceUntil: null,
    cancelAtPeriodEnd: false,
  };
  it('expires exactly at the period boundary without deleting data', () => {
    expect(subscriptionState(paid, now).plan).toBe('premium');
    expect(subscriptionState(paid, paid.periodEnd).plan).toBe('free');
  });
  it('keeps cancelled-at-end access only through the paid interval', () =>
    expect(
      subscriptionState({ ...paid, cancelAtPeriodEnd: true }, now).status,
    ).toBe('cancelling'));
  it('bounds trials and past-due grace separately', () => {
    expect(
      subscriptionState(
        {
          ...paid,
          status: 'trialing',
          trialEndsAt: new Date(now.getTime() - 1),
        },
        now,
      ).plan,
    ).toBe('free');
    expect(
      subscriptionState(
        {
          ...paid,
          status: 'past_due',
          graceUntil: new Date(now.getTime() + 1),
        },
        now,
      ).status,
    ).toBe('grace');
    expect(
      subscriptionState({ ...paid, status: 'past_due', graceUntil: now }, now)
        .plan,
    ).toBe('free');
  });
  it('clamps calendar month and leap-year sandbox periods', () => {
    expect(
      sandboxPeriodEnd(
        'monthly',
        new Date('2026-01-31T12:00:00.000Z'),
      ).toISOString(),
    ).toBe('2026-02-28T12:00:00.000Z');
    expect(
      sandboxPeriodEnd(
        'annual',
        new Date('2028-02-29T12:00:00.000Z'),
      ).toISOString(),
    ).toBe('2029-02-28T12:00:00.000Z');
  });
  it('rejects unknown editions', () =>
    expect(subscriptionState({ ...paid, plan: 'enterprise' }, now).plan).toBe(
      'free',
    ));
  it('authenticates exact bytes and rejects stale, altered and malformed signatures', () => {
    const raw = Buffer.from('{"test":true}'),
      secret = 'independent-sandbox-secret-123456789',
      stamp = String(Math.floor(now.getTime() / 1000));
    const signature = createHmac('sha256', secret)
      .update(stamp + '.')
      .update(raw)
      .digest('hex');
    expect(() =>
      verifyBillingSignature(raw, stamp, signature, secret, now.getTime()),
    ).not.toThrow();
    for (const args of [
      [Buffer.from('{"test":false}'), stamp, signature],
      [raw, stamp, 'x'.repeat(64)],
      [raw, String(Number(stamp) - 301), signature],
    ] as const)
      expect(() =>
        verifyBillingSignature(
          args[0],
          args[1],
          args[2],
          secret,
          now.getTime(),
        ),
      ).toThrow();
  });
});
