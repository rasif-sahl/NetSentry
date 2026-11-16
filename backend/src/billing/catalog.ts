export const features = [
  'network',
  'developer',
  'advanced_apps',
  'family',
  'business',
] as const;
export type Feature = (typeof features)[number];
export const catalog = {
  free: {
    label: 'Personal Free',
    workspaceTypes: ['PERSONAL', 'FAMILY', 'BUSINESS'],
    devices: 2,
    agents: 1,
    members: 1,
    networks: 0,
    rawDays: 7,
    aggregateDays: 30,
    features: [] as string[],
  },
  premium: {
    label: 'Personal Premium',
    workspaceTypes: ['PERSONAL'],
    devices: 10,
    agents: 3,
    members: 1,
    networks: 3,
    rawDays: 30,
    aggregateDays: 365,
    features: ['network', 'developer', 'advanced_apps'],
  },
  family: {
    label: 'Family',
    workspaceTypes: ['FAMILY'],
    devices: 20,
    agents: 5,
    members: 8,
    networks: 5,
    rawDays: 30,
    aggregateDays: 365,
    features: ['network', 'developer', 'advanced_apps', 'family'],
  },
  business: {
    label: 'Business',
    workspaceTypes: ['BUSINESS'],
    devices: 100,
    agents: 20,
    members: 50,
    networks: 20,
    rawDays: 90,
    aggregateDays: 730,
    features: [...features],
  },
};
export type Plan = keyof typeof catalog;
export const paidPlans = ['premium', 'family', 'business'];
export const sandboxAmounts = {
  premium: { monthly: 1000, annual: 10000 },
  family: { monthly: 2000, annual: 20000 },
  business: { monthly: 5000, annual: 50000 },
};
export function subscriptionState(
  s: {
    plan: string;
    status: string;
    trialEndsAt: Date | null;
    periodEnd: Date | null;
    graceUntil: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null,
  now = new Date(),
) {
  if (!s || !Object.hasOwn(catalog, s.plan) || s.plan === 'free')
    return { plan: 'free' as Plan, status: 'free' };
  if (s.status === 'trialing' && s.trialEndsAt && s.trialEndsAt > now)
    return { plan: s.plan as Plan, status: 'trialing' };
  if (s.status === 'active' && s.periodEnd && s.periodEnd > now)
    return {
      plan: s.plan as Plan,
      status: s.cancelAtPeriodEnd ? 'cancelling' : 'active',
    };
  if (s.status === 'past_due' && s.graceUntil && s.graceUntil > now)
    return { plan: s.plan as Plan, status: 'grace' };
  return {
    plan: 'free' as Plan,
    status: s.status === 'cancelled' ? 'cancelled' : 'expired',
  };
}

export function sandboxPeriodEnd(interval: string, now = new Date()) {
  const year = now.getUTCFullYear() + (interval === 'annual' ? 1 : 0),
    month = now.getUTCMonth() + (interval === 'monthly' ? 1 : 0);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(now.getUTCDate(), lastDay),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );
}
