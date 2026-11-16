import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Subscription, FeatureSetting } from './billing.entities';
import { catalog, Feature, subscriptionState } from './catalog';
export function billingMode() {
  return process.env.BILLING_MODE?.trim() === 'sandbox' &&
    process.env.NODE_ENV !== 'production'
    ? 'sandbox'
    : 'disabled';
}
export function billingEnforced() {
  return ['true', '1', 'yes'].includes(
    (process.env.BILLING_ENFORCEMENT ?? '').trim().toLowerCase(),
  );
}
export async function entitlements(m: EntityManager, workspaceId: string) {
  const subscription = await m.findOneBy(Subscription, { workspaceId });
  const state =
    subscription?.plan !== 'free' &&
    subscription &&
    (billingMode() !== 'sandbox' || subscription.provider !== 'sandbox')
      ? { plan: 'free' as const, status: 'provider_unavailable' }
      : subscriptionState(subscription);
  const settings = await m.find(FeatureSetting, {
    where: [{ scope: 'global' }, { scope: workspaceId }],
  });
  const limits = catalog[state.plan];
  const available = Object.fromEntries(
    (
      [
        'network',
        'developer',
        'advanced_apps',
        'family',
        'business',
      ] as Feature[]
    ).map((f) => [
      f,
      !settings.some((s) => s.key === f && !s.enabled) &&
        (!billingEnforced() || limits.features.includes(f)),
    ]),
  );
  return {
    edition: state.plan,
    status: state.status,
    enforced: billingEnforced(),
    mode: billingMode(),
    limits,
    features: available,
    revision: subscription?.revision ?? 0,
    periodEnd: subscription?.periodEnd ?? null,
    trialEndsAt: subscription?.trialEndsAt ?? null,
    graceUntil: subscription?.graceUntil ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
  };
}
export async function assertFeature(
  m: EntityManager,
  workspaceId: string,
  feature: Feature,
) {
  if (!(await entitlements(m, workspaceId)).features[feature])
    throw new ForbiddenException(
      'This feature is unavailable for the current edition or platform configuration. Permissions and OS authorization are still required.',
    );
}
export async function assertCapacity(
  m: EntityManager,
  workspaceId: string,
  resource: 'devices' | 'agents' | 'members' | 'networks',
) {
  if (!billingEnforced()) return;
  const e = await entitlements(m, workspaceId),
    table = {
      devices: 'registered_devices',
      agents: 'agents',
      members: 'memberships',
      networks: 'usage_networks',
    }[resource];
  const [row] = await m.query(
    `SELECT count(*)::int AS n FROM ${table} WHERE "workspaceId"=$1 ${resource === 'devices' ? `AND state='ACTIVE' AND "removedAt" IS NULL` : resource === 'agents' ? `AND state='ACTIVE'` : ''}`,
    [workspaceId],
  );
  if (row.n >= e.limits[resource])
    throw new ForbiddenException(
      'Edition capacity reached. Existing data and privacy controls remain available.',
    );
}
