import {
  evaluateFamily,
  validateRules,
  type FamilyRules,
} from '../family.rules';
const rules = (): FamilyRules => ({
  enabled: true,
  dailyMinutes: 60,
  appLimits: [],
  categoryLimits: [],
  allowedApps: [],
  restrictedApps: [],
  schedules: [],
  pauseUntil: null,
  networkPause: false,
  domains: [],
  domainCategories: [],
});
const usage = { minutes: null, apps: {}, categories: {} };
describe('family policy evaluation', () => {
  it('does not interpret missing observations as zero usage', () => {
    expect(evaluateFamily(rules(), 'UTC', new Date(), usage).state).toBe(
      'observing',
    );
    expect(
      evaluateFamily(rules(), 'UTC', new Date(), { ...usage, minutes: 49 })
        .warnings,
    ).toEqual(['daily_limit']);
    expect(
      evaluateFamily(rules(), 'UTC', new Date(), { ...usage, minutes: 60 })
        .reasons,
    ).toEqual(['daily_limit']);
  });
  it('handles overnight weekends and exclusive schedule endings', () => {
    const r = rules();
    r.schedules = [
      { kind: 'weekend', days: [6], start: '22:00', end: '07:00' },
    ];
    expect(
      evaluateFamily(r, 'UTC', new Date('2026-11-15T06:59:00Z'), usage).reasons,
    ).toEqual(['weekend']);
    expect(
      evaluateFamily(r, 'UTC', new Date('2026-11-15T07:00:00Z'), usage).reasons,
    ).toEqual([]);
    expect(
      evaluateFamily(r, 'UTC', new Date('2026-11-16T02:00:00Z'), usage).reasons,
    ).toEqual([]);
  });
  it('evaluates both repeated DST hours in the selected zone', () => {
    const r = rules();
    r.schedules = [
      { kind: 'bedtime', days: [0], start: '01:00', end: '02:00' },
    ];
    for (const time of ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'])
      expect(
        evaluateFamily(r, 'America/New_York', new Date(time), usage).reasons,
      ).toEqual(['bedtime']);
  });
  it('expires overrides exactly and never changes enforcement authority', () => {
    const r = rules();
    r.networkPause = true;
    const now = new Date();
    expect(
      evaluateFamily(r, 'UTC', now, usage, new Date(now.getTime() + 1)).state,
    ).toBe('overridden');
    expect(evaluateFamily(r, 'UTC', now, usage, now).state).toBe(
      'restriction_requested',
    );
    r.enabled = false;
    expect(
      evaluateFamily(r, 'UTC', now, usage, new Date(now.getTime() + 100)).state,
    ).toBe('disabled');
  });
  it('rejects unknown actions, contradictory apps and malformed schedules', () => {
    for (const r of [
      { ...rules(), execute: 'shell' },
      { ...rules(), allowedApps: ['a.b'], restrictedApps: ['a.b'] },
      { ...rules(), dailyMinutes: -1 },
      {
        ...rules(),
        schedules: [
          { kind: 'bedtime', days: [7], start: '00:00', end: '08:00' },
        ],
      },
      { ...rules(), domains: ['https://private.example/path'] },
    ])
      expect(() => validateRules(r)).toThrow();
    expect(validateRules(rules()).enabled).toBe(true);
  });
});

describe('catalogue category compatibility', () => {
  it('accepts custom category UUIDs and explicit comparison purpose without inferring it from a name', () => {
    const r = rules();
    r.categoryLimits = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        minutes: 120,
        purpose: 'education',
      },
    ];
    expect(validateRules(r).categoryLimits[0].purpose).toBe('education');
    expect(() =>
      validateRules({
        ...r,
        categoryLimits: [{ ...r.categoryLimits[0], purpose: 'guessed' }],
      }),
    ).toThrow();
    expect(() =>
      validateRules({
        ...r,
        appLimits: [
          { id: 'com.example.app', minutes: 30, purpose: 'education' },
        ],
      }),
    ).toThrow();
  });
});
