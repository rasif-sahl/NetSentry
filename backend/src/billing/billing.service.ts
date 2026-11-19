import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
import { workspacePolicy } from '../workspaces/workspace-policy';
import { WorkspacePermission as P } from '../workspaces/workspace-access.service';
import {
  Subscription,
  BillingRequest,
  BillingEvent,
  Payment,
} from './billing.entities';
import {
  catalog,
  Plan,
  sandboxAmounts,
  sandboxPeriodEnd,
  subscriptionState,
} from './catalog';
import { billingMode, entitlements } from './policy';
import { PlanRequestDto, BillingEventDto } from './dto/billing.dto';
import { payloadHash } from './signature';
@Injectable()
export class BillingService {
  constructor(private readonly source: DataSource) {}
  private sandbox() {
    if (billingMode() !== 'sandbox')
      throw new ForbiddenException(
        'Live billing is unconfigured. The provider-neutral sandbox is available only in test/development.',
      );
  }
  private async row(m: EntityManager, wid: string) {
    return (
      (await m.findOneBy(Subscription, { workspaceId: wid })) ??
      m.create(Subscription, {
        workspaceId: wid,
        plan: 'free',
        status: 'free',
        interval: 'monthly',
        revision: 0,
        lastSequence: 0,
        trialUsed: false,
        periodEnd: null,
        trialEndsAt: null,
        graceUntil: null,
        cancelAtPeriodEnd: false,
        provider: 'none',
      })
    );
  }
  private checkPlan(type: string, plan: string) {
    if (
      !Object.hasOwn(catalog, plan) ||
      !(catalog[plan as Plan].workspaceTypes as string[]).includes(type)
    )
      throw new BadRequestException(
        'Choose the edition matching this workspace type.',
      );
  }
  access(uid: string, wid: string) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, uid, wid, P.READ);
      return entitlements(m, wid);
    });
  }
  overview(uid: string, wid: string) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, uid, wid, P.MANAGE_BILLING);
      const e = await entitlements(m, wid);
      const usage: Record<string, number> = {};
      for (const [name, table] of Object.entries({
        devices: 'registered_devices',
        agents: 'agents',
        members: 'memberships',
        networks: 'usage_networks',
      })) {
        const [r] = await m.query(
          `SELECT count(*)::int AS n FROM ${table} WHERE "workspaceId"=$1 ${['devices', 'agents'].includes(name) ? `AND state='ACTIVE'` : ''}`,
          [wid],
        );
        usage[name] = r.n;
      }
      return {
        entitlements: e,
        catalog,
        usage,
        payments: await m.find(Payment, {
          where: { workspaceId: wid },
          order: { paidAt: 'DESC' },
          take: 100,
        }),
        requests: await m.find(BillingRequest, {
          where: { workspaceId: wid },
          order: { createdAt: 'DESC' },
          take: 20,
        }),
        notice:
          'Provider-neutral sandbox. Amounts are synthetic test units, not offered prices. No live charge, invoice, tax calculation, external portal or mobile purchase is configured.',
      };
    });
  }
  trial(uid: string, wid: string, i: PlanRequestDto) {
    this.sandbox();
    return this.source.transaction(async (m) => {
      const { workspace } = await workspacePolicy(
        m,
        uid,
        wid,
        P.MANAGE_BILLING,
      );
      this.checkPlan(workspace.type, i.plan);
      const prior = await m.findOneBy(BillingRequest, {
        workspaceId: wid,
        requestId: i.requestId,
      });
      if (prior) {
        if (
          prior.status !== 'trial' ||
          prior.requesterId !== uid ||
          prior.plan !== i.plan ||
          prior.interval !== i.interval ||
          prior.expectedRevision !== i.expectedRevision
        )
          throw new ConflictException('Trial request ID conflict.');
        return entitlements(m, wid);
      }
      const s = await this.row(m, wid);
      if (s.revision !== i.expectedRevision)
        throw new ConflictException('Refresh subscription state.');
      if (s.trialUsed || subscriptionState(s).plan !== 'free')
        throw new ConflictException(
          'A trial has already been used or a subscription is active.',
        );
      s.plan = i.plan;
      s.interval = i.interval;
      s.status = 'trialing';
      s.trialUsed = true;
      s.trialEndsAt = new Date(Date.now() + 14 * 86400000);
      s.periodEnd = s.trialEndsAt;
      s.provider = 'sandbox';
      s.revision++;
      await m.save(s);
      await m.save(
        m.create(BillingRequest, {
          workspaceId: wid,
          requestId: i.requestId,
          requesterId: uid,
          plan: i.plan,
          interval: i.interval,
          expectedRevision: i.expectedRevision,
          status: 'trial',
        }),
      );
      return entitlements(m, wid);
    });
  }
  checkout(uid: string, wid: string, i: PlanRequestDto) {
    this.sandbox();
    return this.source.transaction(async (m) => {
      const { workspace } = await workspacePolicy(
        m,
        uid,
        wid,
        P.MANAGE_BILLING,
      );
      this.checkPlan(workspace.type, i.plan);
      const old = await m.findOneBy(BillingRequest, {
        workspaceId: wid,
        requestId: i.requestId,
      });
      if (old) {
        if (
          old.requesterId !== uid ||
          old.plan !== i.plan ||
          old.interval !== i.interval ||
          old.expectedRevision !== i.expectedRevision
        )
          throw new ConflictException(
            'Billing request ID was reused with different contents.',
          );
        return old;
      }
      const s = await this.row(m, wid);
      if (s.revision !== i.expectedRevision)
        throw new ConflictException('Refresh subscription state.');
      if ((await m.countBy(BillingRequest, { workspaceId: wid })) >= 1000)
        throw new BadRequestException(
          'Billing request history capacity reached; operator review is required.',
        );
      return m.save(
        m.create(BillingRequest, {
          workspaceId: wid,
          requestId: i.requestId,
          requesterId: uid,
          plan: i.plan,
          interval: i.interval,
          expectedRevision: i.expectedRevision,
        }),
      );
    });
  }
  async confirm(uid: string, wid: string, requestId: string) {
    this.sandbox();
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, uid, wid, P.MANAGE_BILLING);
      const r = await m.findOneBy(BillingRequest, {
        workspaceId: wid,
        requestId,
      });
      if (!r || r.requesterId !== uid)
        throw new ForbiddenException('Billing request is unavailable.');
      if (r.status === 'confirmed') return entitlements(m, wid);
      if (Date.now() - r.createdAt.getTime() > 3600000)
        throw new ConflictException('Sandbox request expired.');
      const s = await this.row(m, wid);
      if (s.revision !== r.expectedRevision)
        throw new ConflictException(
          'Subscription changed; create a new reviewed request.',
        );
      const event: BillingEventDto = {
        id: r.id,
        workspaceId: wid,
        sequence: s.lastSequence + 1,
        occurredAt: new Date().toISOString(),
        plan: r.plan,
        interval: r.interval,
        status: 'active',
        periodEnd: sandboxPeriodEnd(r.interval).toISOString(),
        cancelAtPeriodEnd: false,
        paymentId: r.id,
        amountMinor:
          sandboxAmounts[r.plan as keyof typeof sandboxAmounts][
            r.interval as 'monthly' | 'annual'
          ],
        currency: 'TST',
      };
      await this.apply(
        m,
        event,
        payloadHash(Buffer.from(JSON.stringify(event))),
      );
      r.status = 'confirmed';
      await m.save(r);
      return entitlements(m, wid);
    });
  }
  cancel(uid: string, wid: string, revision: number, resume = false) {
    this.sandbox();
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, uid, wid, P.MANAGE_BILLING);
      const s = await this.row(m, wid);
      if (s.revision !== revision)
        throw new ConflictException('Refresh subscription state.');
      if (subscriptionState(s).plan === 'free')
        throw new ConflictException('No current paid sandbox subscription.');
      s.cancelAtPeriodEnd = !resume;
      s.revision++;
      await m.save(s);
      return entitlements(m, wid);
    });
  }
  async event(i: BillingEventDto, hash: string) {
    this.sandbox();
    return this.source.transaction(async (m) => {
      const workspace = await m.findOne(Workspace, {
        where: { id: i.workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workspace)
        throw new ForbiddenException('Billing workspace is unavailable.');
      this.checkPlan(workspace.type, i.plan);
      return this.apply(m, i, hash);
    });
  }
  private async apply(m: EntityManager, i: BillingEventDto, hash: string) {
    const old = await m
      .getRepository(BillingEvent)
      .createQueryBuilder('e')
      .addSelect('e.payloadHash')
      .where('e.id=:id', { id: i.id })
      .getOne();
    if (old) {
      if (old.workspaceId !== i.workspaceId || old.payloadHash !== hash)
        throw new ConflictException('Billing event ID conflict.');
      return { accepted: true, duplicate: true };
    }
    const duplicateSequence = await m.findOneBy(BillingEvent, {
      workspaceId: i.workspaceId,
      sequence: i.sequence,
    });
    if (duplicateSequence)
      throw new ConflictException('Billing sequence conflict.');
    const now = Date.now(),
      end = new Date(i.periodEnd),
      occurred = new Date(i.occurredAt);
    if (
      !i.occurredAt.endsWith('Z') ||
      !i.periodEnd.endsWith('Z') ||
      !Number.isFinite(end.getTime()) ||
      occurred.getTime() > now + 300000 ||
      end.getTime() > now + 370 * 86400000 ||
      (i.paymentId !== undefined &&
        (i.amountMinor === undefined || !i.currency))
    )
      throw new BadRequestException('Invalid billing event period or payment.');
    const s = await this.row(m, i.workspaceId);
    const outcome = i.sequence > s.lastSequence ? 'applied' : 'ignored_stale';
    if (outcome === 'applied') {
      s.plan = i.plan;
      s.interval = i.interval;
      s.status = i.status;
      s.periodEnd = end;
      s.trialEndsAt = null;
      s.graceUntil =
        i.status === 'past_due'
          ? new Date(Math.min(end.getTime(), occurred.getTime()) + 7 * 86400000)
          : null;
      s.cancelAtPeriodEnd = i.cancelAtPeriodEnd;
      s.lastSequence = i.sequence;
      s.revision++;
      s.provider = 'sandbox';
      await m.save(s);
    }
    if (i.paymentId) {
      const prior = await m.findOneBy(Payment, { id: i.paymentId });
      if (
        prior &&
        (prior.workspaceId !== i.workspaceId ||
          prior.amountMinor !== String(i.amountMinor) ||
          prior.currency !== i.currency)
      )
        throw new ConflictException('Payment ID conflict.');
      if (!prior)
        await m.save(
          m.create(Payment, {
            id: i.paymentId,
            workspaceId: i.workspaceId,
            amountMinor: String(i.amountMinor),
            currency: i.currency!,
            status: i.status === 'active' ? 'paid' : 'recorded',
            provider: 'sandbox',
            paidAt: occurred,
          }),
        );
    }
    await m.save(
      m.create(BillingEvent, {
        id: i.id,
        workspaceId: i.workspaceId,
        sequence: i.sequence,
        payloadHash: hash,
        outcome,
        occurredAt: occurred,
      }),
    );
    return { accepted: true, duplicate: false, outcome };
  }
}
