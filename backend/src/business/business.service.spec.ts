import { businessCompliance } from './business.service';
import { BusinessPolicy } from './business.entities';
import {
  roleAllows,
  WorkspacePermission as P,
} from '../workspaces/workspace-access.service';
import { WorkspaceRole as R } from '../workspaces/membership.entity';
import { DevicePlatform } from '../workspaces/registered-device.entity';
describe('Business observation and authority boundaries', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const device = {
    state: 'ACTIVE',
    removedAt: null,
    lastSeenAt: now,
    permissionStatus: 'granted',
    monitoringEnabled: true,
    platform: DevicePlatform.ANDROID,
  };
  const policy = {
    staleMinutes: 30,
    requireMonitoring: true,
    requirePermission: true,
  } as BusinessPolicy;
  it('does not invent compliance before a policy is configured', () =>
    expect(businessCompliance(device, null, now).state).toBe('not_configured'));
  it('reports only configured checks, not a security or productivity score', () =>
    expect(businessCompliance(device, policy, now)).toEqual({
      state: 'configured_checks_met',
      checks: [],
    }));
  it('distinguishes unknown permission and missing metadata from verified state', () =>
    expect(
      businessCompliance(
        { ...device, lastSeenAt: null, permissionStatus: 'unknown' },
        policy,
        now,
      ).checks,
    ).toEqual(['metadata_stale_or_missing', 'permission_unverified']));
  it('flags expired, future and inactive observations', () => {
    for (const lastSeenAt of [
      new Date(now.getTime() - 1800001),
      new Date(now.getTime() + 1),
    ])
      expect(
        businessCompliance(
          { ...device, lastSeenAt, state: 'REVOKED' },
          policy,
          now,
        ).checks,
      ).toContain('metadata_stale_or_missing');
  });
  it.each([R.NETWORK_ADMIN, R.ANALYST, R.VIEWER, R.EMPLOYEE])(
    'does not give %s billing, membership or service-control authority',
    (role) => {
      for (const p of [P.MANAGE_BILLING, P.MANAGE_MEMBERS, P.CONTROL_SERVICES])
        expect(roleAllows(role, p)).toBe(false);
    },
  );
  it('separates network administration, analytics and employee enrolment', () => {
    expect(roleAllows(R.NETWORK_ADMIN, P.MANAGE_NETWORKS)).toBe(true);
    expect(roleAllows(R.NETWORK_ADMIN, P.READ_REPORTS)).toBe(false);
    expect(roleAllows(R.ANALYST, P.EXPORT_REPORTS)).toBe(true);
    expect(roleAllows(R.ANALYST, P.MANAGE_DEVICES)).toBe(false);
    expect(roleAllows(R.EMPLOYEE, P.REGISTER_DEVICE)).toBe(true);
    expect(roleAllows(R.EMPLOYEE, P.READ_NETWORKS)).toBe(false);
  });
});
