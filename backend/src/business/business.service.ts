import { assertFeature } from '../billing/policy';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { workspacePolicy } from '../workspaces/workspace-policy';
import {
  WorkspacePermission as P,
  roleAllows,
} from '../workspaces/workspace-access.service';
import { WorkspaceRole } from '../workspaces/membership.entity';
import { Membership } from '../workspaces/membership.entity';
import { User, AccountStatus } from '../users/user.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { UsageNetwork } from '../monitoring/entities';
import {
  BusinessEndpointDepartment as EndpointDepartment,
  BusinessLocation as Location,
  BusinessDepartment as Department,
  BusinessEmployee as Employee,
  BusinessAssignment as Assignment,
  BusinessAsset as Asset,
  BusinessNetworkLocation as NetworkLocation,
  BusinessPolicy as Policy,
  BusinessAlertAssignment as AlertAssignment,
  BusinessAudit as Audit,
} from './business.entities';
import {
  NameDto,
  DepartmentDto,
  EmployeeDto,
  EmployeeDepartmentDto,
  AssignmentDto,
  BusinessConsentDto,
  ComplianceDto,
  BusinessAlertDto,
  BusinessReportQuery,
} from './business.dto';
import { businessAudit, revokeBusinessDevice } from './business.lifecycle';

export const businessDisclosure = {
  version: 'business-sharing-v1',
  text: 'Share this assigned device’s consented daily aggregate usage with authorized organization administrators and analysts, grouped by department/location. Sharing starts with the next complete workspace-local day, excludes app identifiers/content, and is bound to the current device generation and assignment. Monitoring/OS permissions are separate. Withdraw to end organization report access; personal export and erasure remain separate. Offboarding revokes organization access and device credentials without erasing employee-owned measurements. Organization device custody must be separately declared by its current registering organization owner. Compliance covers only configured reporting checks, not OS security or employee productivity.',
};
export const custodyDisclosure = {
  version: 'business-custody-v1',
  text: 'I confirm this is an organization-owned device registered by me as organization owner. On organization ownership transfer its registration custody moves to the new owner, credentials and monitoring are revoked, and fresh enrolment/consent is required. Employee assignment does not transfer personal devices or give employee data-deletion rights over organization assets.',
};
export function businessCompliance(
  device: Pick<
    RegisteredDevice,
    | 'state'
    | 'removedAt'
    | 'lastSeenAt'
    | 'permissionStatus'
    | 'monitoringEnabled'
    | 'platform'
  >,
  policy: Policy | null,
  now = new Date(),
) {
  if (!policy) return { state: 'not_configured', checks: [] as string[] };
  const checks: string[] = [];
  if (device.state !== 'ACTIVE' || device.removedAt)
    checks.push('registration_inactive');
  if (
    !device.lastSeenAt ||
    now.getTime() - new Date(device.lastSeenAt).getTime() >
      policy.staleMinutes * 60000 ||
    new Date(device.lastSeenAt) > now
  )
    checks.push('metadata_stale_or_missing');
  if (policy.requireMonitoring && !device.monitoringEnabled)
    checks.push('monitoring_not_enabled');
  if (policy.requirePermission && device.permissionStatus !== 'granted')
    checks.push(
      device.permissionStatus === 'unknown'
        ? 'permission_unverified'
        : 'permission_not_granted',
    );
  return {
    state: checks.length ? 'needs_review' : 'configured_checks_met',
    checks,
  };
}
function reportDates(input: BusinessReportQuery) {
  const first = Date.parse(input.from + 'T00:00:00Z'),
    last = Date.parse(input.to + 'T00:00:00Z');
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    new Date(first).toISOString().slice(0, 10) !== input.from ||
    new Date(last).toISOString().slice(0, 10) !== input.to ||
    last <= first ||
    last - first > 90 * 86400000
  )
    throw new BadRequestException(
      'Choose a valid exclusive date range of at most 90 days.',
    );
}
@Injectable()
export class BusinessService {
  constructor(private readonly source: DataSource) {}
  private async context(
    m: EntityManager,
    uid: string,
    wid: string,
    p = P.READ,
    featureRequired = true,
  ) {
    const c = await workspacePolicy(m, uid, wid, p);
    if (featureRequired && p !== P.READ)
      await assertFeature(m, wid, 'business');
    if (c.workspace.type !== 'BUSINESS')
      throw new ForbiddenException('Choose a Business organization.');
    return c;
  }
  private async location(m: EntityManager, wid: string, id: string) {
    const row = await m.findOneBy(Location, { id, workspaceId: wid });
    if (!row)
      throw new ForbiddenException('Location is outside this organization.');
    return row;
  }
  private async department(m: EntityManager, wid: string, id: string) {
    const row = await m.findOneBy(Department, { id, workspaceId: wid });
    if (!row)
      throw new ForbiddenException('Department is outside this organization.');
    return row;
  }
  private async employee(m: EntityManager, wid: string, id: string) {
    const row = await m.findOneBy(Employee, { id, workspaceId: wid });
    if (!row)
      throw new ForbiddenException('Employee is outside this organization.');
    return row;
  }
  private async device(m: EntityManager, wid: string, id: string) {
    const row = await m.findOneBy(RegisteredDevice, { id, workspaceId: wid });
    if (!row || row.removedAt)
      throw new ForbiddenException('Device is outside this organization.');
    return row;
  }
  private async activeMember(m: EntityManager, wid: string, uid: string) {
    const member = await m.findOneBy(Membership, {
        workspaceId: wid,
        userId: uid,
      }),
      user = await m.findOneBy(User, { id: uid, status: AccountStatus.ACTIVE });
    if (!member || !user?.emailVerifiedAt)
      throw new ForbiddenException(
        'Choose a current verified organization member.',
      );
    return member;
  }
  offboardTarget(uid: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_MEMBERS, false);
      return (await this.employee(m, wid, id)).userId;
    });
  }
  endpointDepartment(
    uid: string,
    wid: string,
    id: string,
    input: { expectedRevision: number; departmentId?: string },
  ) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_NETWORKS);
      if (
        !(
          await m.query(
            `SELECT e.id FROM network_endpoints e JOIN usage_networks n ON n.id=e."networkId" WHERE e.id=$1 AND n."workspaceId"=$2`,
            [id, wid],
          )
        ).length
      )
        throw new ForbiddenException(
          'Observed device is outside this organization.',
        );
      if (input.departmentId) await this.department(m, wid, input.departmentId);
      const prior = await m.findOneBy(EndpointDepartment, { endpointId: id });
      if ((prior?.revision ?? 0) !== input.expectedRevision)
        throw new ConflictException('Refresh the observed device department.');
      const row = await m.save(
        m.create(EndpointDepartment, {
          endpointId: id,
          workspaceId: wid,
          departmentId: input.departmentId ?? null,
          revision: (prior?.revision ?? 0) + 1,
        }),
      );
      await businessAudit(m, wid, uid, 'endpoint_department_saved', id);
      return row;
    });
  }
  overview(uid: string, wid: string, locationId?: string) {
    return this.source.transaction(async (m) => {
      const { workspace, member } = await this.context(m, uid, wid);
      if (locationId) await this.location(m, wid, locationId);
      const manage = roleAllows(member.role, P.MANAGE_MEMBERS),
        inventory = !['EMPLOYEE', 'MEMBER'].includes(member.role);
      const locations = await m.find(Location, {
        where: { workspaceId: wid, ...(locationId ? { id: locationId } : {}) },
        order: { name: 'ASC' },
        take: 200,
      });
      const departments = await m.find(Department, {
        where: { workspaceId: wid, ...(locationId ? { locationId } : {}) },
        order: { name: 'ASC' },
        take: 200,
      });
      const employees = await m.find(Employee, {
        where: { workspaceId: wid, ...(manage ? {} : { userId: uid }) },
        relations: { user: true },
        take: 1000,
      });
      const scopedEmployees = employees.filter(
        (e) => !locationId || departments.some((d) => d.id === e.departmentId),
      );
      const policy = await m.findOneBy(Policy, { workspaceId: wid });
      const allDevices = await m.find(RegisteredDevice, {
        where: { workspaceId: wid, removedAt: IsNull() },
        take: 501,
      });
      if (allDevices.length > 500)
        throw new BadRequestException(
          'Organization device limit is 500 in this implementation.',
        );
      const assignments = await m.findBy(Assignment, { workspaceId: wid });
      const assets = await m.findBy(Asset, { workspaceId: wid });
      const devices = allDevices.filter(
        (d) =>
          (inventory ||
            d.registeredById === uid ||
            assignments.some(
              (a) =>
                a.deviceId === d.id &&
                scopedEmployees.some((e) => e.id === a.employeeId),
            )) &&
          (!locationId ||
            assignments.some(
              (a) =>
                a.deviceId === d.id &&
                scopedEmployees.some((e) => e.id === a.employeeId),
            )),
      );
      const networks = roleAllows(member.role, P.READ_NETWORKS)
        ? await m.query(
            `SELECT n.id,n.name,l."locationId",count(c."agentId")::int AS "collectorCount",count(c."agentId") FILTER (WHERE c.enabled AND c.generation=a.generation AND a.state='ACTIVE' AND c."observedAt">now()-interval '90 seconds')::int AS "freshCollectors" FROM usage_networks n LEFT JOIN business_network_locations l ON l."networkId"=n.id LEFT JOIN network_collectors c ON c."networkId"=n.id LEFT JOIN agents a ON a.id=c."agentId" WHERE n."workspaceId"=$1 AND ($2::uuid IS NULL OR l."locationId"=$2) GROUP BY n.id,n.name,l."locationId" ORDER BY n.name LIMIT 200`,
            [wid, locationId ?? null],
          )
        : [];
      const endpoints = roleAllows(member.role, P.READ_NETWORKS)
        ? await m.query(
            `SELECT e.id,e.name,e."networkId",n.name AS "networkName",a."departmentId",coalesce(a.revision,0)::int AS revision FROM network_endpoints e JOIN usage_networks n ON n.id=e."networkId" LEFT JOIN business_endpoint_departments a ON a."endpointId"=e.id LEFT JOIN business_network_locations l ON l."networkId"=n.id WHERE n."workspaceId"=$1 AND ($2::uuid IS NULL OR l."locationId"=$2) ORDER BY e.id LIMIT 201`,
            [wid, locationId ?? null],
          )
        : [];
      return {
        endpoints: endpoints.slice(0, 200),
        moreEndpoints: endpoints.length > 200,
        organization: {
          id: wid,
          name: workspace.name,
          timezone: workspace.timezone,
        },
        role: member.role,
        permissions: Object.values(P).filter((p) => roleAllows(member.role, p)),
        disclosure: businessDisclosure,
        custodyDisclosure,
        locations: inventory
          ? locations
          : locations.filter((l) =>
              scopedEmployees.some((e) =>
                departments.some(
                  (d) => d.id === e.departmentId && d.locationId === l.id,
                ),
              ),
            ),
        departments: inventory
          ? departments
          : departments.filter((d) =>
              scopedEmployees.some((e) => e.departmentId === d.id),
            ),
        employees: scopedEmployees.map(({ user, ...e }) => ({
          ...e,
          displayName: user.displayName,
          active: !e.offboardedAt,
        })),
        devices: devices.map((d) => ({
          id: d.id,
          name: d.name,
          platform: d.platform,
          state: d.state,
          generation: d.generation,
          registeredById: d.registeredById,
          ownership: assets.some((a) => a.deviceId === d.id)
            ? 'organization'
            : 'registrant',
          lastSeenAt: d.lastSeenAt,
          compliance: businessCompliance(d, policy),
        })),
        assignments: assignments.filter(
          (a) =>
            devices.some((d) => d.id === a.deviceId) &&
            (inventory || scopedEmployees.some((e) => e.id === a.employeeId)),
        ),
        networks,
        policy,
        limits: {
          devices: 500,
          employees: 1000,
          locations: 200,
          departments: 200,
        },
        qualityNote:
          'Metadata freshness is not proof of connectivity or secure configuration. Missing checks are unavailable; configured checks met is not a security certification.',
      };
    });
  }
  saveLocation(uid: string, wid: string, input: NameDto, id?: string) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_NETWORKS);
      let row = id
        ? await this.location(m, wid, id)
        : m.create(Location, { workspaceId: wid, revision: 0 });
      if (row.revision !== input.expectedRevision)
        throw new ConflictException('Refresh the location before saving.');
      if (!id && (await m.countBy(Location, { workspaceId: wid })) >= 200)
        throw new BadRequestException('Location limit reached.');
      const duplicate = await m.findOneBy(Location, {
        workspaceId: wid,
        name: input.name.trim(),
      });
      if (duplicate && duplicate.id !== id)
        throw new ConflictException('Location name is already in use.');
      row.name = input.name.trim();
      row.revision++;
      row = await m.save(row);
      await businessAudit(m, wid, uid, 'location_saved', row.id);
      return row;
    });
  }
  saveDepartment(uid: string, wid: string, input: DepartmentDto, id?: string) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_MEMBERS);
      await this.location(m, wid, input.locationId);
      let row = id
        ? await this.department(m, wid, id)
        : m.create(Department, { workspaceId: wid, revision: 0 });
      if (row.revision !== input.expectedRevision)
        throw new ConflictException('Refresh the department before saving.');
      if (!id && (await m.countBy(Department, { workspaceId: wid })) >= 200)
        throw new BadRequestException('Department limit reached.');
      const duplicate = await m.findOneBy(Department, {
        workspaceId: wid,
        name: input.name.trim(),
      });
      if (duplicate && duplicate.id !== id)
        throw new ConflictException('Department name is already in use.');
      if (id && row.locationId !== input.locationId)
        await m.query(
          `UPDATE business_assignments SET "consentedAt"=NULL,"reportFrom"=NULL,revision=revision+1 WHERE "employeeId" IN (SELECT id FROM business_employees WHERE "workspaceId"=$1 AND "departmentId"=$2)`,
          [wid, id],
        );
      row.name = input.name.trim();
      row.locationId = input.locationId;
      row.revision++;
      row = await m.save(row);
      await businessAudit(m, wid, uid, 'department_saved', row.id);
      return row;
    });
  }
  createEmployee(uid: string, wid: string, input: EmployeeDto) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_MEMBERS);
      await this.activeMember(m, wid, input.userId);
      if (input.departmentId) await this.department(m, wid, input.departmentId);
      if (
        await m.existsBy(Employee, { workspaceId: wid, userId: input.userId })
      )
        throw new ConflictException(
          'Employee already exists; update its department or invite the offboarded member again.',
        );
      if ((await m.countBy(Employee, { workspaceId: wid })) >= 1000)
        throw new BadRequestException('Employee limit reached.');
      const row = await m.save(
        m.create(Employee, {
          workspaceId: wid,
          userId: input.userId,
          departmentId: input.departmentId ?? null,
          offboardedAt: null,
        }),
      );
      await businessAudit(m, wid, uid, 'employee_enrolled', row.id);
      return row;
    });
  }
  updateEmployee(
    uid: string,
    wid: string,
    id: string,
    input: EmployeeDepartmentDto,
  ) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_MEMBERS);
      const row = await this.employee(m, wid, id);
      await this.activeMember(m, wid, row.userId);
      if (input.departmentId) await this.department(m, wid, input.departmentId);
      if (row.revision !== input.expectedRevision)
        throw new ConflictException('Refresh the employee before saving.');
      row.departmentId = input.departmentId ?? null;
      row.offboardedAt = null;
      row.revision++;
      await m.save(row);
      await m.query(
        `UPDATE business_assignments SET "consentedAt"=NULL,"reportFrom"=NULL,revision=revision+1 WHERE "workspaceId"=$1 AND "employeeId"=$2`,
        [wid, id],
      );
      await businessAudit(m, wid, uid, 'employee_updated', id);
      return row;
    });
  }
  locateNetwork(uid: string, wid: string, id: string, locationId: string) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_NETWORKS);
      await this.location(m, wid, locationId);
      if (!(await m.existsBy(UsageNetwork, { id, workspaceId: wid })))
        throw new ForbiddenException('Network is outside this organization.');
      const row = await m.save(
        m.create(NetworkLocation, {
          networkId: id,
          workspaceId: wid,
          locationId,
        }),
      );
      await businessAudit(m, wid, uid, 'network_located', id);
      return row;
    });
  }
  declareAsset(uid: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      const { workspace, member } = await this.context(
          m,
          uid,
          wid,
          P.MANAGE_DEVICES,
        ),
        d = await this.device(m, wid, id);
      if (
        member.role !== WorkspaceRole.OWNER ||
        d.registeredById !== workspace.ownerId ||
        uid !== workspace.ownerId
      )
        throw new ForbiddenException(
          'Only the registering organization owner may declare company custody. Personal devices cannot be claimed.',
        );
      if (await m.existsBy(Asset, { deviceId: id })) return { declared: true };
      await m.save(
        m.create(Asset, {
          deviceId: id,
          workspaceId: wid,
          declaredAt: new Date(),
        }),
      );
      await businessAudit(m, wid, uid, 'organization_custody_declared', id);
      return { declared: true };
    });
  }
  assign(uid: string, wid: string, id: string, input: AssignmentDto) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_DEVICES);
      const employee = await this.employee(m, wid, input.employeeId),
        d = await this.device(m, wid, id);
      await this.activeMember(m, wid, employee.userId);
      if (employee.offboardedAt || d.state !== 'ACTIVE')
        throw new ConflictException(
          'Choose an active employee and active device.',
        );
      if (
        d.registeredById !== employee.userId &&
        !(await m.existsBy(Asset, { deviceId: id, workspaceId: wid }))
      )
        throw new ForbiddenException(
          'Use the employee’s own device or a separately declared organization asset.',
        );
      const prior = await m.findOneBy(Assignment, { deviceId: id });
      if ((prior?.revision ?? 0) !== input.expectedRevision)
        throw new ConflictException('Refresh the device assignment.');
      const row = await m.save(
        m.create(Assignment, {
          deviceId: id,
          workspaceId: wid,
          employeeId: employee.id,
          generation: d.generation,
          revision: (prior?.revision ?? 0) + 1,
          consentedAt: null,
          reportFrom: null,
        }),
      );
      await businessAudit(m, wid, uid, 'device_assigned', id);
      return row;
    });
  }
  consent(uid: string, wid: string, id: string, input: BusinessConsentDto) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid);
      const a = await m.findOneBy(Assignment, {
          deviceId: id,
          workspaceId: wid,
        }),
        d = await this.device(m, wid, id);
      if (!a) throw new ForbiddenException('Assignment is unavailable.');
      const employee = await this.employee(m, wid, a.employeeId);
      if (employee.userId !== uid || employee.offboardedAt)
        throw new ForbiddenException(
          'Only the assigned employee accepts organization sharing.',
        );
      if (
        a.revision !== input.expectedRevision ||
        d.generation !== input.generation ||
        d.state !== 'ACTIVE'
      )
        throw new ConflictException(
          'Refresh the assignment and device generation before accepting.',
        );
      const [date] = await m.query(
        `SELECT ((now() AT TIME ZONE timezone)::date+1)::text AS date FROM workspaces WHERE id=$1`,
        [wid],
      );
      a.generation = d.generation;
      a.consentedAt = new Date();
      a.reportFrom = date.date;
      a.revision++;
      await m.save(a);
      await businessAudit(m, wid, uid, 'sharing_accepted', id);
      return a;
    });
  }
  withdraw(uid: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      const { member } = await this.context(m, uid, wid, P.READ, false),
        d = await this.device(m, wid, id),
        a = await m.findOneBy(Assignment, { deviceId: id, workspaceId: wid });
      const e = a ? await this.employee(m, wid, a.employeeId) : null;
      if (
        d.registeredById !== uid &&
        e?.userId !== uid &&
        !roleAllows(member.role, P.MANAGE_DEVICES)
      )
        throw new ForbiddenException('Assignment withdrawal is not permitted.');
      await m.delete(Assignment, { deviceId: id, workspaceId: wid });
      await businessAudit(m, wid, uid, 'sharing_withdrawn', id);
      return { withdrawn: true };
    });
  }
  unenrol(uid: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_DEVICES, false);
      const d = await this.device(m, wid, id);
      await revokeBusinessDevice(m, d, uid);
      return { unenrolled: true, personalDataErased: false };
    });
  }
  compliance(uid: string, wid: string, input: ComplianceDto) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.MANAGE_POLICIES);
      let row = await m.findOneBy(Policy, { workspaceId: wid });
      if ((row?.revision ?? 0) !== input.expectedRevision)
        throw new ConflictException('Refresh the reporting-check policy.');
      row = await m.save(
        m.create(Policy, {
          workspaceId: wid,
          revision: (row?.revision ?? 0) + 1,
          staleMinutes: input.staleMinutes,
          requireMonitoring: input.requireMonitoring,
          requirePermission: input.requirePermission,
        }),
      );
      await businessAudit(m, wid, uid, 'compliance_policy_saved', wid);
      return row;
    });
  }
  report(
    uid: string,
    wid: string,
    input: BusinessReportQuery,
    exporting = false,
  ) {
    reportDates(input);
    return this.source.transaction('REPEATABLE READ', async (m) => {
      const { workspace } = await this.context(m, uid, wid, P.READ_REPORTS);
      if (exporting) await this.context(m, uid, wid, P.EXPORT_REPORTS);
      if (input.locationId) await this.location(m, wid, input.locationId);
      if (input.departmentId) await this.department(m, wid, input.departmentId);
      const rows = await m.query(
        `SELECT u."localDate"::text AS "localDate",u.metric,u.quality,u."sourceKind",u."collectorVersion",dep.id AS "departmentId",dep."locationId",sum(u.value)::text AS value,count(DISTINCT u."deviceId")::int AS "deviceCount" FROM daily_usage u JOIN registered_devices d ON d.id=u."deviceId" AND d."workspaceId"=u."workspaceId" JOIN business_assignments a ON a."deviceId"=d.id AND a."workspaceId"=d."workspaceId" AND a.generation=d.generation JOIN business_employees e ON e.id=a."employeeId" AND e."workspaceId"=a."workspaceId" JOIN memberships m ON m."userId"=e."userId" AND m."workspaceId"=e."workspaceId" JOIN users usr ON usr.id=e."userId" AND usr.status='ACTIVE' LEFT JOIN business_departments dep ON dep.id=e."departmentId" AND dep."workspaceId"=e."workspaceId" WHERE u."workspaceId"=$1 AND u."localDate">=$2 AND u."localDate"<$3 AND u.timezone=$4 AND a."consentedAt" IS NOT NULL AND u."localDate">=a."reportFrom" AND e."offboardedAt" IS NULL AND d.state='ACTIVE' AND d."monitoringEnabled" AND d."removedAt" IS NULL AND ($5::uuid IS NULL OR dep."locationId"=$5) AND ($6::uuid IS NULL OR dep.id=$6) GROUP BY u."localDate",u.metric,u.quality,u."sourceKind",u."collectorVersion",dep.id,dep."locationId" ORDER BY u."localDate",u.metric,u.quality LIMIT 2001`,
        [
          wid,
          input.from,
          input.to,
          workspace.timezone,
          input.locationId ?? null,
          input.departmentId ?? null,
        ],
      );
      if (rows.length > 2000)
        throw new BadRequestException(
          'Narrow the date range or location; report exceeds 2000 aggregate rows.',
        );
      if (exporting) await businessAudit(m, wid, uid, 'report_exported');
      return {
        schemaVersion: 1,
        workspaceId: wid,
        from: input.from,
        to: input.to,
        timezone: workspace.timezone,
        rows,
        qualityNote:
          'Consented daily aggregates only, starting on the first complete post-sharing local day. Missing records mean unavailable, not zero. Sources/qualities remain distinct; overlapping sources may not be additive. No app identifiers, browsing content, employee productivity score or proof of security.',
        generatedAt: new Date().toISOString(),
      };
    });
  }
  alerts(uid: string, wid: string) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.HANDLE_ALERTS);
      return m.query(
        `SELECT e.id,e.kind,e.severity,e."occurredAt",e."acknowledgedAt",e."networkId",n.name AS "networkName",l."locationId",a."assigneeId",coalesce(a.revision,0)::int AS revision,a."resolvedAt" FROM network_events e JOIN usage_networks n ON n.id=e."networkId" LEFT JOIN business_network_locations l ON l."networkId"=n.id LEFT JOIN business_alert_assignments a ON a."eventId"=e.id WHERE n."workspaceId"=$1 ORDER BY e."occurredAt" DESC LIMIT 200`,
        [wid],
      );
    });
  }
  assignAlert(uid: string, wid: string, id: string, input: BusinessAlertDto) {
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.HANDLE_ALERTS);
      if (
        !(
          await m.query(
            `SELECT e.id FROM network_events e JOIN usage_networks n ON n.id=e."networkId" WHERE e.id=$1 AND n."workspaceId"=$2`,
            [id, wid],
          )
        ).length
      )
        throw new ForbiddenException('Alert is outside this organization.');
      if (input.assigneeId) {
        const assignee = await this.activeMember(m, wid, input.assigneeId);
        if (!roleAllows(assignee.role, P.HANDLE_ALERTS))
          throw new ForbiddenException(
            'Assign alerts to a current alert handler.',
          );
      }
      const prior = await m.findOneBy(AlertAssignment, { eventId: id });
      if ((prior?.revision ?? 0) !== input.expectedRevision)
        throw new ConflictException('Refresh the alert assignment.');
      const row = await m.save(
        m.create(AlertAssignment, {
          eventId: id,
          workspaceId: wid,
          assigneeId: input.assigneeId ?? null,
          revision: (prior?.revision ?? 0) + 1,
          resolvedAt: input.resolved ? new Date() : null,
        }),
      );
      await businessAudit(m, wid, uid, 'alert_assigned', id);
      return row;
    });
  }
  audit(
    uid: string,
    wid: string,
    input: BusinessReportQuery,
    exporting = false,
  ) {
    reportDates(input);
    if (input.locationId || input.departmentId)
      throw new BadRequestException(
        'Audit is organization-wide; use date bounds only.',
      );
    return this.source.transaction(async (m) => {
      await this.context(m, uid, wid, P.READ_AUDIT);
      if (exporting) await this.context(m, uid, wid, P.EXPORT_REPORTS);
      const rows = await m.query(
        `SELECT * FROM (
          SELECT id,"actorId",action,"targetId","occurredAt",'business' AS source FROM business_audit WHERE "workspaceId"=$1
          UNION ALL SELECT e.id,e."actorId",e.kind,e."networkId",e."occurredAt",'network' AS source FROM network_events e JOIN usage_networks n ON n.id=e."networkId" WHERE n."workspaceId"=$1
          UNION ALL SELECT a.id,c."requesterId" AS "actorId",a.event,c.id AS "targetId",a."occurredAt",'developer' AS source FROM developer_audit a JOIN developer_commands c ON c.id=a."commandId" JOIN agents ag ON ag.id=c."agentId" WHERE ag."workspaceId"=$1
        ) retained WHERE "occurredAt">=$2::date AND "occurredAt"<$3::date ORDER BY "occurredAt",id LIMIT 1001`,
        [wid, input.from, input.to],
      );
      if (rows.length > 1000)
        throw new BadRequestException(
          'Narrow the audit range to at most 1000 entries.',
        );
      if (exporting) await businessAudit(m, wid, uid, 'audit_exported');
      return {
        workspaceId: wid,
        rows,
        retentionDays: 90,
        sourceRetentionDays: { business: 90, network: 30, developer: 7 },
        generatedAt: new Date().toISOString(),
      };
    });
  }
}
