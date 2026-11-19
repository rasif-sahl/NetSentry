import { BadRequestException } from '@nestjs/common';
export type FamilyRules = {
  enabled: boolean;
  dailyMinutes: number | null;
  appLimits: { id: string; minutes: number }[];
  categoryLimits: {
    id: string;
    minutes: number;
    purpose?: 'education' | 'entertainment' | 'other';
  }[];
  allowedApps: string[];
  restrictedApps: string[];
  schedules: {
    kind: 'bedtime' | 'study' | 'weekend';
    days: number[];
    start: string;
    end: string;
  }[];
  pauseUntil: string | null;
  networkPause: boolean;
  domains: string[];
  domainCategories: string[];
};
export const familyDisclosure = {
  version: 'family-sharing-v1',
  text: 'Share the assigned device’s consented usage with the named child and their explicitly authorized guardians. Assignment does not enable collection, supply device credentials, or grant enforcement authority. Child requests and guardian decisions are recorded. Current Android usage access and the read-only router adapter cannot enforce other-app, network or domain restrictions; saved policies remain unsupported until a separately authorized and verified adapter exists. No restrictions are reported applied. Family usage starts on the first full local day after assignment. Profile age bands and avatars are labels, not age verification. Withdraw an assignment to end future family access; erasing device measurements is separate.',
};
export const enforcementAdapters = [
  {
    id: 'android-consumer-v1',
    platform: 'ANDROID',
    status: 'unsupported',
    actions: [],
    reason:
      'Usage access observes apps; it cannot suspend other apps or establish device-owner authorization.',
  },
  {
    id: 'openwrt-ubus-v1',
    platform: 'ROUTER',
    status: 'unsupported',
    actions: [],
    reason:
      'The existing adapter is read-only; no firewall or DNS enforcement is authorized.',
  },
];
export function wallTime(at: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      parts.weekday,
    ),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
export function validateRules(value: unknown): FamilyRules {
  const bad = () => {
    throw new BadRequestException('Invalid family policy rules.');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bad();
  const r = value as FamilyRules;
  const fields = [
    'enabled',
    'dailyMinutes',
    'appLimits',
    'categoryLimits',
    'allowedApps',
    'restrictedApps',
    'schedules',
    'pauseUntil',
    'networkPause',
    'domains',
    'domainCategories',
  ];
  if (
    Object.keys(r).length !== fields.length ||
    Object.keys(r).some((k) => !fields.includes(k))
  )
    return bad();
  const minutes = (v: unknown) =>
    Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 1440;
  const ids = (v: unknown, max: number, pattern: RegExp): v is string[] =>
    Array.isArray(v) &&
    v.length <= max &&
    new Set(v).size === v.length &&
    v.every((x) => typeof x === 'string' && pattern.test(x));
  const app = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;
  const category = /^[a-z][a-z0-9_]{0,63}$/;
  if (
    typeof r.enabled !== 'boolean' ||
    typeof r.networkPause !== 'boolean' ||
    (r.dailyMinutes !== null && !minutes(r.dailyMinutes))
  )
    return bad();
  for (const [items, pattern] of [
    [r.appLimits, app],
    [
      r.categoryLimits,
      /^(?:[a-z][a-z0-9_]{0,63}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/,
    ],
  ] as const) {
    if (
      !Array.isArray(items) ||
      items.length > 32 ||
      new Set(items.map((x) => x?.id)).size !== items.length ||
      items.some(
        (x) =>
          !x ||
          (Object.keys(x).sort().join(',') !== 'id,minutes' &&
            !(
              items === r.categoryLimits &&
              Object.keys(x).sort().join(',') === 'id,minutes,purpose' &&
              'purpose' in x &&
              typeof x.purpose === 'string' &&
              ['education', 'entertainment', 'other'].includes(x.purpose)
            )) ||
          typeof x.id !== 'string' ||
          x.id.length > 150 ||
          !pattern.test(x.id) ||
          !minutes(x.minutes),
      )
    )
      return bad();
  }
  if (
    !ids(r.allowedApps, 64, app) ||
    !ids(r.restrictedApps, 64, app) ||
    r.allowedApps.some((x) => r.restrictedApps.includes(x)) ||
    [...r.allowedApps, ...r.restrictedApps].some((x) => x.length > 150)
  )
    return bad();
  if (
    !ids(
      r.domains,
      64,
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    ) ||
    !ids(r.domainCategories, 16, category)
  )
    return bad();
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (
    !Array.isArray(r.schedules) ||
    r.schedules.length > 12 ||
    r.schedules.some(
      (s) =>
        !s ||
        Object.keys(s).sort().join(',') !== 'days,end,kind,start' ||
        !['bedtime', 'study', 'weekend'].includes(s.kind) ||
        !Array.isArray(s.days) ||
        s.days.length < 1 ||
        s.days.length > 7 ||
        new Set(s.days).size !== s.days.length ||
        s.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
        !clock.test(s.start) ||
        !clock.test(s.end) ||
        s.start === s.end,
    )
  )
    return bad();
  if (
    r.pauseUntil !== null &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.pauseUntil) ||
      !Number.isFinite(Date.parse(r.pauseUntil)) ||
      Date.parse(r.pauseUntil) <= Date.now() ||
      Date.parse(r.pauseUntil) > Date.now() + 86400000)
  )
    return bad();
  return r;
}
export function evaluateFamily(
  r: FamilyRules,
  timezone: string,
  now: Date,
  usage: {
    minutes: number | null;
    apps: Record<string, number>;
    categories: Record<string, number>;
  },
  overrideUntil?: Date | null,
) {
  const local = wallTime(now, timezone),
    reasons: string[] = [],
    warnings: string[] = [];
  if (!r.enabled) return { state: 'disabled', reasons, warnings };
  if (overrideUntil && overrideUntil > now)
    return { state: 'overridden', reasons, warnings };
  if (r.pauseUntil && Date.parse(r.pauseUntil) > now.getTime())
    reasons.push('temporary_pause');
  for (const s of r.schedules) {
    const n = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3)),
      start = n(s.start),
      end = n(s.end);
    if (
      start < end
        ? s.days.includes(local.day) &&
          local.minute >= start &&
          local.minute < end
        : (s.days.includes(local.day) && local.minute >= start) ||
          (s.days.includes((local.day + 6) % 7) && local.minute < end)
    )
      reasons.push(s.kind);
  }
  const limit = (label: string, value: number | null, maximum: number) => {
    if (value !== null) {
      if (value >= maximum) reasons.push(label);
      else if (value >= maximum * 0.8) warnings.push(label);
    }
  };
  if (r.dailyMinutes !== null)
    limit('daily_limit', usage.minutes, r.dailyMinutes);
  for (const l of r.appLimits)
    limit(`app:${l.id}`, usage.apps[l.id] ?? null, l.minutes);
  for (const l of r.categoryLimits)
    limit(`category:${l.id}`, usage.categories[l.id] ?? null, l.minutes);
  if (r.networkPause) reasons.push('network_pause');
  if (r.restrictedApps.length) reasons.push('restricted_app_selection');
  if (r.domains.length || r.domainCategories.length)
    reasons.push('domain_filter_selection');
  return {
    state: reasons.length
      ? 'restriction_requested'
      : warnings.length
        ? 'warning'
        : 'observing',
    reasons,
    warnings,
  };
}
