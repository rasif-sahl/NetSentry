import { Workspace } from '../workspaces/workspace.entity';
import { workspacePolicy } from '../workspaces/workspace-policy';
import { WorkspacePermission as P } from '../workspaces/workspace-access.service';
import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, Between } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  FamilyProfile,
  FamilyAssignment,
  FamilyPolicy,
  FamilyRequest,
  FamilyReceipt,
  FamilyEvent,
} from './family.entities';
import { familyScope, familyAuthor } from './family.access';
import {
  familyDisclosure,
  enforcementAdapters,
  validateRules,
  evaluateFamily,
  wallTime,
  type FamilyRules,
} from './family.rules';
import {
  ProfileDto,
  FamilyAssignmentDto,
  FamilyPolicyDto,
  FamilyRequestDto,
  FamilyFeedbackDto,
  FamilyReceiptDto,
} from './family.dto';
import { Membership } from '../workspaces/membership.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { User, AccountStatus } from '../users/user.entity';
import { UsageNetwork } from '../monitoring/entities';
import {
  ApplicationDay,
  ApplicationCatalog,
} from '../monitoring/application.entities';
import { classification } from '../monitoring/application.service';
@Injectable()
export class FamilyService {
  constructor(private readonly source: DataSource) {}
  private event(
    m: EntityManager,
    profileId: string,
    actorId: string | null,
    kind: string,
    detail: Record<string, unknown> = {},
  ) {
    return m.save(
      m.create(FamilyEvent, {
        profileId,
        actorId,
        kind,
        detail,
        occurredAt: new Date(),
      }),
    );
  }
  async overview(uid: string, wid: string) {
    return this.source.transaction(async (m) => {
      const scope = await familyScope(m, uid, wid);
      return {
        disclosure: familyDisclosure,
        canCreate: scope.elevated,
        profiles: scope.profiles.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          ageBand: p.ageBand,
          archived: p.archived,
          revision: p.revision,
          canManage:
            scope.elevated ||
            (scope.member.role === 'GUARDIAN' && p.guardians.includes(uid)),
        })),
        adapters: enforcementAdapters,
      };
    });
  }
  async profile(uid: string, wid: string, input: ProfileDto, id?: string) {
    return this.source.transaction(async (m) => {
      const scope = await familyScope(m, uid, wid, id);
      if (!scope.elevated)
        throw new ForbiddenException(
          'Only family owners/admins manage profiles and guardian grants.',
        );
      if (!id && (await m.countBy(FamilyProfile, { workspaceId: wid })) >= 32)
        throw new BadRequestException('Family profile limit reached.');
      for (const guardian of input.guardians) {
        const member = await m.findOneBy(Membership, {
            workspaceId: wid,
            userId: guardian,
          }),
          user = await m.findOneBy(User, {
            id: guardian,
            status: AccountStatus.ACTIVE,
          });
        if (
          !member ||
          !['OWNER', 'ADMIN', 'GUARDIAN'].includes(member.role) ||
          !user?.emailVerifiedAt
        )
          throw new BadRequestException(
            'Guardians must be current verified family owners, admins or guardians.',
          );
      }
      if (input.userId) {
        const member = await m.findOneBy(Membership, {
          workspaceId: wid,
          userId: input.userId,
        });
        if (
          member?.role !== 'MEMBER' ||
          (await m
            .getRepository(FamilyProfile)
            .createQueryBuilder('p')
            .where('p."workspaceId"=:wid AND p."userId"=:uid AND p.id<>:id', {
              wid,
              uid: input.userId,
              id: id ?? randomUUID(),
            })
            .getExists())
        )
          throw new BadRequestException(
            'A child account must be a current MEMBER linked to only one profile.',
          );
      }
      for (const networkId of input.networks)
        if (
          !(await m.existsBy(UsageNetwork, { id: networkId, workspaceId: wid }))
        )
          throw new BadRequestException(
            'Network labels must belong to this family.',
          );
      const p = id
        ? scope.profiles[0]
        : m.create(FamilyProfile, { workspaceId: wid, revision: 0 });
      if (p.revision !== input.expectedRevision)
        throw new ConflictException(
          'Refresh the current profile before changing grants or labels.',
        );
      if (id && p.userId !== input.userId) {
        await m.delete(FamilyAssignment, { profileId: id });
        await m.delete(FamilyRequest, { profileId: id });
        await m.delete(FamilyEvent, { profileId: id });
      }
      Object.assign(p, {
        name: input.name.trim(),
        avatar: input.avatar,
        ageBand: input.ageBand,
        userId: input.userId,
        guardians: input.guardians,
        networks: input.networks,
        archived: input.archived,
      });
      p.revision++;
      await m.save(p);
      await m.delete(FamilyReceipt, {
        deviceId: In(
          (await m.findBy(FamilyAssignment, { profileId: p.id })).map(
            (a) => a.deviceId,
          ),
        ),
      });
      await this.event(m, p.id, uid, 'profile_consent_updated', {
        revision: p.revision,
        disclosureVersion: input.disclosureVersion,
      });
      return p;
    });
  }
  async erase(uid: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      const scope = await familyScope(m, uid, wid, id);
      if (!scope.elevated)
        throw new ForbiddenException(
          'Only family owners/admins erase profiles.',
        );
      await m.delete(FamilyProfile, { id });
      return { removed: true };
    });
  }
  async assign(
    uid: string,
    wid: string,
    id: string,
    input: FamilyAssignmentDto,
  ) {
    return this.source.transaction(async (m) => {
      const { profiles } = await familyScope(m, uid, wid, id);
      const p = profiles[0];
      if (p.archived)
        throw new ForbiddenException(
          'Unarchive the profile before assignment.',
        );
      const device = await m.findOneBy(RegisteredDevice, {
        id: input.deviceId,
        workspaceId: wid,
        registeredById: uid,
        state: 'ACTIVE',
      });
      if (!device)
        throw new ForbiddenException(
          'Only the active device owner can consent to an assignment.',
        );
      const old = await m.findOneBy(FamilyAssignment, { deviceId: device.id });
      if (old && old.profileId !== id)
        throw new ConflictException(
          'Withdraw the previous assignment before choosing another child.',
        );
      const currentBindings = await this.bindings(m, p);
      if (
        !currentBindings.some((b) => b.device.id === device.id) &&
        currentBindings.length >= 20
      )
        throw new BadRequestException('Child device limit reached.');
      if (
        old &&
        old.generation === device.generation &&
        old.profileRevision === p.revision
      )
        return old;
      await m.delete(FamilyReceipt, { deviceId: device.id });
      const a = await m.save(
        m.create(FamilyAssignment, {
          deviceId: device.id,
          profileId: id,
          generation: device.generation,
          profileRevision: p.revision,
          consentedAt: new Date(),
          disclosureVersion: input.disclosureVersion,
        }),
      );
      await this.event(m, id, uid, 'device_sharing_consented', {
        deviceId: device.id,
        generation: device.generation,
      });
      return a;
    });
  }
  async withdrawOwn(uid: string, deviceId: string) {
    return this.source.transaction(async (m) => {
      const candidate = await m.findOneBy(RegisteredDevice, {
        id: deviceId,
        registeredById: uid,
      });
      if (!candidate)
        throw new ForbiddenException(
          'Only the device owner can withdraw this sharing.',
        );
      await m.findOneOrFail(Workspace, {
        where: { id: candidate.workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      const assignment = await m.findOneBy(FamilyAssignment, { deviceId });
      if (assignment) {
        await m.delete(FamilyAssignment, { deviceId });
        await this.event(
          m,
          assignment.profileId,
          uid,
          'device_sharing_withdrawn',
          { deviceId },
        );
      }
      return { removed: true };
    });
  }
  async withdraw(uid: string, wid: string, id: string, deviceId: string) {
    return this.source.transaction(async (m) => {
      await familyScope(m, uid, wid, id);
      const device = await m.findOneBy(RegisteredDevice, {
          id: deviceId,
          workspaceId: wid,
        }),
        assignment = await m.findOneBy(FamilyAssignment, {
          deviceId,
          profileId: id,
        });
      if (
        !device ||
        !assignment ||
        (device.registeredById !== uid &&
          (await m.findOneBy(FamilyProfile, { id }))?.userId !== uid &&
          !(await familyAuthor(
            m,
            await m.findOneByOrFail(FamilyProfile, { id }),
            uid,
          )))
      )
        throw new ForbiddenException(
          'Device owner or assigned guardian required.',
        );
      await m.delete(FamilyAssignment, { deviceId });
      await this.event(m, id, uid, 'device_sharing_withdrawn', { deviceId });
      return { removed: true };
    });
  }
  async policy(uid: string, wid: string, id: string, input: FamilyPolicyDto) {
    const rules = validateRules(input.rules);
    return this.source.transaction(async (m) => {
      const { workspace } = await familyScope(m, uid, wid, id, true);
      let p = await m.findOneBy(FamilyPolicy, { profileId: id });
      if ((p?.revision ?? 0) !== input.expectedRevision)
        throw new ConflictException(
          'Refresh the current policy before saving.',
        );
      p = m.create(FamilyPolicy, {
        profileId: id,
        revision: (p?.revision ?? 0) + 1,
        rules,
        timezone: workspace.timezone,
        authorId: uid,
        updatedAt: new Date(),
      });
      await m.save(p);
      await this.event(m, id, uid, 'policy_saved', {
        revision: p.revision,
        disclosureVersion: input.disclosureVersion,
        enforcement: 'unsupported',
      });
      return p;
    });
  }
  private async bindings(m: EntityManager, p: FamilyProfile) {
    const assignments = await m.findBy(FamilyAssignment, { profileId: p.id }),
      result: { assignment: FamilyAssignment; device: RegisteredDevice }[] = [];
    for (const a of assignments) {
      if (a.profileRevision !== p.revision) continue;
      const device = await m.findOneBy(RegisteredDevice, {
        id: a.deviceId,
        workspaceId: p.workspaceId,
        state: 'ACTIVE',
        generation: a.generation,
      });
      const owner = device
        ? await m.findOneBy(User, {
            id: device.registeredById,
            status: AccountStatus.ACTIVE,
          })
        : null;
      const member = device
        ? await m.findOneBy(Membership, {
            workspaceId: p.workspaceId,
            userId: device.registeredById,
          })
        : null;
      if (
        device &&
        owner?.emailVerifiedAt &&
        member &&
        member.role !== 'VIEWER'
      )
        result.push({ assignment: a, device });
    }
    return result;
  }
  private async report(
    m: EntityManager,
    p: FamilyProfile,
    timezone: string,
    now = new Date(),
    rules?: FamilyRules,
  ) {
    const bindings = await this.bindings(m, p),
      today = wallTime(now, timezone).date,
      start = new Date(`${today}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 13);
    const from = start.toISOString().slice(0, 10),
      mid = new Date(`${today}T00:00:00Z`);
    mid.setUTCDate(mid.getUTCDate() - 6);
    const week = mid.toISOString().slice(0, 10);
    const days: Record<
        string,
        { minutes: number; coverageMinutes: number; lateNightMinutes: number }
      > = {},
      apps: Record<string, number> = {},
      categories: Record<string, number> = {};
    const trends: Record<
      string,
      Record<string, { currentMinutes: number; previousMinutes: number }>
    > = { applications: {}, categories: {} };
    let current = 0,
      prior = 0,
      currentCoverage = 0,
      priorCoverage = 0,
      education = 0,
      entertainment = 0,
      todayMinutes: number | null = null;
    for (const { assignment: a, device } of bindings) {
      const consentDate = wallTime(a.consentedAt, timezone).date;
      const rows = await m.find(ApplicationDay, {
        where: {
          deviceId: device.id,
          timezone,
          localDate: Between(from, today),
        },
        take: 10001,
      });
      if (rows.length > 10000)
        throw new BadRequestException('Narrow family reporting scope.');
      const catalog = await m.findOneBy(ApplicationCatalog, {
        deviceId: device.id,
      });
      for (const r of rows) {
        if (r.localDate <= consentDate) continue;
        const minutes = Number(r.durationMs) / 60000,
          coverage = Number(r.coverageMs) / 60000,
          night = Number(r.lateNightMs) / 60000;
        if (r.applicationId === '') {
          const d = (days[r.localDate] ??= {
            minutes: 0,
            coverageMinutes: 0,
            lateNightMinutes: 0,
          });
          d.minutes += minutes;
          d.coverageMinutes += coverage;
          if (r.localDate >= week) {
            current += minutes;
            currentCoverage += coverage;
          } else {
            prior += minutes;
            priorCoverage += coverage;
          }
          if (r.localDate === today)
            todayMinutes = (todayMinutes ?? 0) + minutes;
        } else {
          const metadata = catalog?.applications.find(
              (a) => a.applicationId === r.applicationId,
            ),
            category =
              metadata && catalog
                ? classification(metadata, catalog).categoryId
                : 'unknown';
          for (const [kind, key] of [
            ['applications', r.applicationId],
            ['categories', category],
          ]) {
            const trend = (trends[kind][key] ??= {
              currentMinutes: 0,
              previousMinutes: 0,
            });
            if (r.localDate >= week) trend.currentMinutes += minutes;
            else trend.previousMinutes += minutes;
          }
          if (r.localDate === today) {
            apps[r.applicationId] = (apps[r.applicationId] ?? 0) + minutes;
            categories[category] = (categories[category] ?? 0) + minutes;
          }
          if (r.localDate >= week) {
            const purpose = rules?.categoryLimits.find(
              (l) => l.id === category,
            )?.purpose;
            if (purpose === 'education') education += minutes;
            if (
              purpose === 'entertainment' ||
              (!purpose &&
                ['game', 'audio', 'video', 'social'].includes(category))
            )
              entertainment += minutes;
          }
          const d = (days[r.localDate] ??= {
            minutes: 0,
            coverageMinutes: 0,
            lateNightMinutes: 0,
          });
          d.lateNightMinutes += night;
        }
      }
    }
    const comparable =
      bindings.every(
        (b) => wallTime(b.assignment.consentedAt, timezone).date < from,
      ) &&
      Object.values(days).filter((d) => d.coverageMinutes > 0).length === 14 &&
      currentCoverage > 0 &&
      priorCoverage > 0 &&
      Math.abs(currentCoverage - priorCoverage) /
        Math.max(currentCoverage, priorCoverage) <=
        0.1;
    return {
      from,
      to: today,
      timezone,
      source: 'estimated_android_usage',
      days: Object.entries(days)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v })),
      currentWeekMinutes: current,
      previousWeekMinutes: prior,
      comparisonPercent:
        comparable && prior > 0 ? ((current - prior) / prior) * 100 : null,
      educationMinutes: education,
      entertainmentMinutes: entertainment,
      applicationTrends: Object.entries(trends.applications)
        .map(([id, v]) => ({ id, ...v }))
        .sort(
          (a, b) =>
            b.currentMinutes - a.currentMinutes || a.id.localeCompare(b.id),
        )
        .slice(0, 32),
      categoryTrends: Object.entries(trends.categories)
        .map(([id, v]) => ({ id, ...v }))
        .sort(
          (a, b) =>
            b.currentMinutes - a.currentMinutes || a.id.localeCompare(b.id),
        )
        .slice(0, 32),
      confidence:
        currentCoverage > 0 ? 'partial_observations' : 'insufficient_data',
      evidence:
        'Accepted estimated device-day aggregates after the first full consented local day. Summed devices can overlap; this is not attention, diagnosis or a complete observation window.',
      suggestions: [
        ...(Object.values(days).some((d) => d.lateNightMinutes > 30)
          ? [
              'Review whether a bedtime schedule would help; late-night observations may be incomplete.',
            ]
          : []),
        ...(bindings.some(
          (b) =>
            !b.device.lastSyncedAt ||
            now.getTime() - b.device.lastSyncedAt.getTime() > 86400000,
        )
          ? [
              'An assigned device has not reported recently; missing usage is unknown.',
            ]
          : []),
      ],
      usage: { minutes: todayMinutes, apps, categories },
      bindings,
    };
  }
  private async activeOverride(
    m: EntityManager,
    p: FamilyProfile,
    policy: FamilyPolicy,
    now = new Date(),
  ) {
    const rows = await m.find(FamilyRequest, {
      where: {
        profileId: p.id,
        state: 'approved',
        policyRevision: policy.revision,
      },
      order: { decidedAt: 'DESC' },
      take: 100,
    });
    for (const r of rows)
      if (
        r.overrideUntil &&
        r.overrideUntil > now &&
        (await familyAuthor(m, p, r.decidedBy))
      )
        return r.overrideUntil;
    return null;
  }
  async view(uid: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      const { workspace, profiles, member, elevated } = await familyScope(
        m,
        uid,
        wid,
        id,
      );
      const p = profiles[0],
        policy = await m.findOneBy(FamilyPolicy, { profileId: id }),
        report = await this.report(
          m,
          p,
          policy?.timezone ?? workspace.timezone,
          new Date(),
          policy?.rules,
        );
      const { bindings, usage, ...publicReport } = report;
      const override = policy ? await this.activeOverride(m, p, policy) : null,
        valid = policy && (await familyAuthor(m, p, policy.authorId));
      const requests = await m.find(FamilyRequest, {
        where: { profileId: id },
        order: { requestedAt: 'DESC' },
        take: 100,
      });
      return {
        profile: p,
        canManage:
          elevated || (member.role === 'GUARDIAN' && p.guardians.includes(uid)),
        canRequest: member.role === 'MEMBER' && p.userId === uid && !p.archived,
        policy,
        desired: valid
          ? evaluateFamily(
              policy.rules,
              policy.timezone,
              new Date(),
              usage,
              override,
            )
          : {
              state: policy ? 'author_unavailable' : 'not_configured',
              reasons: [],
              warnings: [],
            },
        overrideUntil: override,
        report: publicReport,
        devices: await Promise.all(
          bindings.map(async ({ assignment: a, device: d }) => {
            const receipt = await m.findOneBy(FamilyReceipt, {
              deviceId: d.id,
            });
            return {
              deviceId: d.id,
              name: d.name,
              platform: d.platform,
              generation: d.generation,
              consentedAt: a.consentedAt,
              enforcement:
                receipt &&
                receipt.policyRevision === policy?.revision &&
                receipt.profileRevision === p.revision &&
                receipt.generation === d.generation &&
                Date.now() - receipt.receivedAt.getTime() < 90000
                  ? receipt.status
                  : 'unconfirmed',
              receivedAt: receipt?.receivedAt ?? null,
            };
          }),
        ),
        requests: requests.map((r) =>
          Object.assign({}, r, {
            state:
              r.state === 'pending' && r.expiresAt < new Date()
                ? 'expired'
                : r.state,
            overrideUntil:
              r.policyRevision === policy?.revision ? r.overrideUntil : null,
          }),
        ),
        timeline: await m.find(FamilyEvent, {
          where: { profileId: id },
          order: { occurredAt: 'DESC' },
          take: 100,
        }),
        adapters: enforcementAdapters,
        disclosure: familyDisclosure,
      };
    });
  }
  async request(
    uid: string,
    wid: string,
    id: string,
    input: FamilyRequestDto,
    direct = false,
  ) {
    return this.source.transaction(async (m) => {
      const { profiles, member } = await familyScope(m, uid, wid, id, direct);
      const p = profiles[0];
      if (
        !direct &&
        (member.role !== 'MEMBER' || p.userId !== uid || p.archived)
      )
        throw new ForbiddenException(
          'Only the linked child account can request more time.',
        );
      const policy = await m.findOneBy(FamilyPolicy, { profileId: id });
      if (
        !policy ||
        policy.revision !== input.policyRevision ||
        !(await familyAuthor(m, p, policy.authorId))
      )
        throw new ConflictException('Refresh the current authorized policy.');
      const old = await m.findOneBy(FamilyRequest, { id: input.id });
      if (old) {
        if (
          old.profileId !== id ||
          old.requesterId !== uid ||
          old.minutes !== input.minutes ||
          old.reason !== input.reason ||
          old.policyRevision !== input.policyRevision
        )
          throw new ConflictException('Request ID was reused.');
        return old;
      }
      if ((await m.countBy(FamilyRequest, { profileId: id })) >= 1000)
        throw new BadRequestException('Request history capacity reached.');
      const now = new Date();
      const r = await m.save(
        m.create(FamilyRequest, {
          id: input.id,
          profileId: id,
          requesterId: uid,
          policyRevision: policy.revision,
          minutes: input.minutes,
          reason: input.reason,
          state: direct ? 'approved' : 'pending',
          requestedAt: now,
          expiresAt: new Date(now.getTime() + 86400000),
          decidedBy: direct ? uid : null,
          decidedAt: direct ? now : null,
          overrideUntil: direct
            ? new Date(now.getTime() + input.minutes * 60000)
            : null,
        }),
      );
      await this.event(
        m,
        id,
        uid,
        direct ? 'guardian_override' : 'child_request',
        { requestId: r.id, minutes: r.minutes },
      );
      return r;
    });
  }
  async decide(
    uid: string,
    wid: string,
    id: string,
    rid: string,
    decision: string,
  ) {
    return this.source.transaction(async (m) => {
      const scope = await familyScope(
          m,
          uid,
          wid,
          id,
          decision !== 'cancelled',
        ),
        p = scope.profiles[0],
        r = await m.findOneBy(FamilyRequest, { id: rid, profileId: id });
      if (!r || r.state !== 'pending' || r.expiresAt <= new Date())
        throw new ConflictException('This request is no longer pending.');
      if (decision === 'cancelled' && r.requesterId !== uid)
        throw new ForbiddenException('Only the requester can cancel.');
      const policy = await m.findOneBy(FamilyPolicy, { profileId: id });
      if (
        !policy ||
        policy.revision !== r.policyRevision ||
        !(await familyAuthor(m, p, policy.authorId))
      )
        throw new ConflictException('Policy changed; make a fresh request.');
      r.state = decision;
      r.decidedBy = uid;
      r.decidedAt = new Date();
      r.overrideUntil =
        decision === 'approved'
          ? new Date(Date.now() + r.minutes * 60000)
          : null;
      await m.save(r);
      await this.event(m, id, uid, 'request_decided', {
        requestId: r.id,
        decision,
      });
      return r;
    });
  }
  async feedback(
    uid: string,
    wid: string,
    id: string,
    input: FamilyFeedbackDto,
  ) {
    return this.source.transaction(async (m) => {
      await familyScope(m, uid, wid, id);
      await this.event(
        m,
        id,
        uid,
        'insight_feedback',
        input as unknown as Record<string, unknown>,
      );
      return { saved: true };
    });
  }
  async deviceConfiguration(deviceId: string, generation: number) {
    return this.source.transaction(async (m) => {
      const owner = await m.findOneByOrFail(RegisteredDevice, { id: deviceId });
      await workspacePolicy(
        m,
        owner.registeredById,
        owner.workspaceId,
        P.REGISTER_DEVICE,
      );
      const d = await m.findOneBy(RegisteredDevice, {
        id: deviceId,
        state: 'ACTIVE',
        generation,
      });
      if (!d) throw new ForbiddenException('Device generation changed.');
      const a = await m.findOneBy(FamilyAssignment, { deviceId, generation });
      if (!a)
        return {
          schemaVersion: 1,
          assignment: null,
          adapters: enforcementAdapters,
        };
      const p = await m.findOneByOrFail(FamilyProfile, { id: a.profileId });
      const bindings = await this.bindings(m, p);
      if (!bindings.some((b) => b.device.id === deviceId) || p.archived)
        return {
          schemaVersion: 1,
          assignment: null,
          adapters: enforcementAdapters,
        };
      const policy = await m.findOneBy(FamilyPolicy, { profileId: p.id });
      const valid = policy && (await familyAuthor(m, p, policy.authorId));
      return {
        schemaVersion: 1,
        assignment: {
          profileId: p.id,
          profileRevision: p.revision,
          profileName: p.name,
          generation,
          policyRevision: policy?.revision ?? 0,
          rules: valid ? policy.rules : null,
          timezone: policy?.timezone ?? 'UTC',
          overrideUntil: valid ? await this.activeOverride(m, p, policy) : null,
          enforcement: 'unsupported',
          consentedAt: a.consentedAt,
        },
        adapters: enforcementAdapters,
      };
    });
  }
  async receipt(deviceId: string, input: FamilyReceiptDto) {
    return this.source.transaction(async (m) => {
      const owner = await m.findOneByOrFail(RegisteredDevice, { id: deviceId });
      await workspacePolicy(
        m,
        owner.registeredById,
        owner.workspaceId,
        P.REGISTER_DEVICE,
      );
      const d = await m.findOneBy(RegisteredDevice, {
          id: deviceId,
          state: 'ACTIVE',
          generation: input.generation,
        }),
        a = await m.findOneBy(FamilyAssignment, {
          deviceId,
          generation: input.generation,
        }),
        p = a ? await m.findOneBy(FamilyProfile, { id: a.profileId }) : null,
        policy = p
          ? await m.findOneBy(FamilyPolicy, { profileId: p.id })
          : null;
      if (
        !d ||
        !a ||
        !p ||
        a.profileRevision !== p.revision ||
        p.archived ||
        p.revision !== input.profileRevision ||
        policy?.revision !== input.policyRevision ||
        !(await familyAuthor(m, p, policy.authorId))
      )
        throw new ConflictException(
          'Assignment, generation or policy changed.',
        );
      const old = await m.findOneBy(FamilyReceipt, { deviceId });
      await m.save(
        m.create(FamilyReceipt, {
          deviceId,
          generation: input.generation,
          profileRevision: input.profileRevision,
          policyRevision: input.policyRevision,
          status: input.status,
          receivedAt: new Date(),
        }),
      );
      if (
        !old ||
        old.status !== input.status ||
        old.policyRevision !== input.policyRevision ||
        old.profileRevision !== input.profileRevision
      )
        await this.event(
          m,
          p.id,
          null,
          input.status === 'failed'
            ? 'enforcement_failed'
            : 'policy_sync_received',
          { deviceId, revision: input.policyRevision, status: input.status },
        );
      return { accepted: true };
    });
  }
}
