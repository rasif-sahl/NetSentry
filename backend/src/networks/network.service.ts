import { PageQuery, SearchPageQuery, selectPage } from '../common/pagination';
import { assertCapacity } from '../billing/other/policy';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, In, MoreThanOrEqual } from 'typeorm';
import { randomUUID, X509Certificate } from 'node:crypto';
import { AgentService } from '../agents/agent.service';
import { Agent } from '../agents/entity/agent.entities';
import { workspacePolicy } from '../workspaces/other/workspace-policy';
import { WorkspacePermission as P } from '../workspaces/workspace-access.service';
import { Membership } from '../workspaces/entity/membership.entity';
import { User, AccountStatus } from '../users/entity/user.entity';
import { roleAllows } from '../workspaces/workspace-access.service';
import { RegisteredDevice } from '../workspaces/entity/registered-device.entity';
import { UsageNetwork } from '../monitoring/entity/entities';
import { fingerprint } from '../monitoring/other/values';
import {
  NetworkPresence,
  NetworkProfile,
  NetworkCollector,
  NetworkEndpoint,
  NetworkSighting,
  NetworkRouter,
  NetworkSample,
  NetworkEvent,
  NetworkCompatibility,
} from './entity/network.entities';
import {
  contains,
  prefix,
  routerURL,
  encryptRouter,
  decryptRouter,
  adapterProfiles,
} from './other/network-values';
import {
  NetworkSiteDto,
  NetworkGrantDto,
  NetworkLocalDto,
  NetworkSnapshotDto,
  RouterSetupDto,
  EndpointUpdateDto,
  NetworkEventDto,
  CompatibilityDto,
} from './dto/network.dto';
import { eraseNetworkAgent } from './other/network-lifecycle';
import { recordNetworkEvent } from './other/network-events';
import { recordNeighborObservations } from './other/network-inventory';
import { recordRouterSample } from './other/network-router-samples';
function publicRouter(router: NetworkRouter | null) {
  if (!router) return null;
  return {
    id: router.id,
    agentId: router.agentId,
    adapter: router.adapter,
    url: router.url,
    interfaceName: router.interfaceName,
    revision: router.revision,
    manufacturer: router.manufacturer,
    model: router.model,
    firmware: router.firmware,
    reportedModel: router.reportedModel,
    reportedFirmware: router.reportedFirmware,
    credentialConfigured: Boolean(router.encryptedCredentials),
    testRequestId: router.testRequestId,
    testRequestedAt: router.testRequestedAt,
    testStatus:
      router.testStatus === 'pending' &&
      router.testRequestedAt &&
      Date.now() - router.testRequestedAt.getTime() > 90000
        ? 'expired'
        : router.testStatus,
  };
}
@Injectable()
export class NetworkService {
  constructor(
    private readonly source: DataSource,
    private readonly agents: AgentService,
  ) {}
  private async site(m: EntityManager, wid: string, id: string) {
    const label = await m.findOneBy(UsageNetwork, { id, workspaceId: wid }),
      profile = await m.findOneBy(NetworkProfile, { networkId: id });
    if (!label || !profile)
      throw new ForbiddenException('Network is outside this workspace.');
    return { label, profile };
  }
  async list(userId: string, wid: string) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.READ_NETWORKS);
      const labels = await m.findBy(UsageNetwork, { workspaceId: wid });
      const profiles = labels.length
        ? await m.findBy(NetworkProfile, {
            networkId: In(labels.map((n) => n.id)),
          })
        : [];
      return profiles.map((profile) =>
        Object.assign({}, profile, {
          name: labels.find((label) => label.id === profile.networkId)!.name,
        }),
      );
    });
  }
  async listPage(userId: string, wid: string, query: SearchPageQuery) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.READ_NETWORKS);
      const builder = m
        .createQueryBuilder(NetworkProfile, 'profile')
        .innerJoinAndSelect(
          'profile.network',
          'label',
          'label."workspaceId" = :wid',
          { wid },
        );
      const search = query.search?.trim();
      if (search)
        builder.andWhere(
          `strpos(lower(label.name || ' ' || profile.cidrs::text), lower(:search)) > 0`,
          { search },
        );
      const page = await selectPage(builder, query, {
        id: 'networkId',
        timestamp: 'createdAt',
      });
      return {
        ...page,
        items: page.items.map(({ network, ...profile }) => ({
          ...profile,
          name: network.name,
        })),
      };
    });
  }
  async save(userId: string, wid: string, input: NetworkSiteDto, id?: string) {
    for (const c of input.cidrs) prefix(c);
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.MANAGE_NETWORKS);
      if (!id && (await m.countBy(UsageNetwork, { workspaceId: wid })) >= 200)
        throw new BadRequestException('Workspace network limit reached.');
      let label: UsageNetwork, profile: NetworkProfile;
      if (id) {
        ({ label, profile } = await this.site(m, wid, id));
      } else {
        await assertCapacity(m, wid, 'networks');
        label = await m.save(
          m.create(UsageNetwork, {
            workspaceId: wid,
            name: input.name.trim(),
            createdById: userId,
          }),
        );
        profile = m.create(NetworkProfile, { networkId: label.id });
      }
      label.name = input.name.trim();
      profile.cidrs = input.cidrs;
      await m.save(label);
      await m.save(profile);
      if (id) {
        await m.increment(NetworkCollector, { networkId: id }, 'revision', 1);
        await m.update(
          NetworkCollector,
          { networkId: id },
          {
            observedAt: null,
            interfaces: [],
            snapshotId: null,
            snapshotHash: null,
          },
        );
        await m.query(
          'DELETE FROM network_sightings WHERE "agentId" IN (SELECT "agentId" FROM network_collectors WHERE "networkId"=$1)',
          [id],
        );
      }
      await recordNetworkEvent(
        m,
        label.id,
        'network_updated',
        'info',
        null,
        null,
        userId,
      );
      return Object.assign({}, profile, { name: label.name });
    });
  }
  async remove(userId: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.MANAGE_NETWORKS);
      await this.site(m, wid, id);
      await m.delete(NetworkProfile, { networkId: id });
      return { removed: true };
    });
  }
  async grant(userId: string, wid: string, id: string, input: NetworkGrantDto) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.MANAGE_NETWORKS);
      await this.site(m, wid, id);
      const agent = await m.findOneBy(Agent, {
        id: input.agentId,
        workspaceId: wid,
      });
      if (!agent || agent.state !== 'ACTIVE' || !agent.modules.network)
        throw new ForbiddenException(
          'Choose an active network-enabled workspace agent.',
        );
      await workspacePolicy(m, agent.userId, wid, P.MANAGE_NETWORKS);
      const old = await m.findOneBy(NetworkCollector, { agentId: agent.id });
      if (
        (!old || old.networkId !== id) &&
        (await m.countBy(NetworkCollector, { networkId: id })) >= 20
      )
        throw new BadRequestException('Network collector limit reached.');
      const revision = (old?.revision ?? 0) + 1;
      if (old && old.networkId !== id) await eraseNetworkAgent(m, agent.id);
      await m.delete(NetworkSighting, { agentId: agent.id });
      const value = await m.save(
        m.create(NetworkCollector, {
          agentId: agent.id,
          networkId: id,
          generation: agent.generation,
          revision,
          enabled: input.enabled,
          observedAt: null,
          snapshotId: null,
          snapshotHash: null,
          interfaces: [],
          health: input.enabled ? 'unknown' : 'disabled',
        }),
      );
      await recordNetworkEvent(
        m,
        id,
        'collector_policy_updated',
        'info',
        agent.id,
        null,
        userId,
      );
      const { snapshotHash: _hash, ...safe } = value;
      return safe;
    });
  }
  private async gate(
    m: EntityManager,
    agent: Agent,
    input: NetworkLocalDto | NetworkSnapshotDto,
  ) {
    await workspacePolicy(
      m,
      agent.userId,
      agent.workspaceId,
      P.MANAGE_NETWORKS,
    );
    const collector = await m
      .getRepository(NetworkCollector)
      .createQueryBuilder('c')
      .addSelect('c.snapshotHash')
      .where('c."agentId"=:id', { id: agent.id })
      .getOne();
    if (
      !agent.modules.network ||
      !collector ||
      !collector.enabled ||
      collector.generation !== agent.generation ||
      input.generation !== agent.generation ||
      collector.networkId !== input.networkId
    )
      throw new ForbiddenException(
        'Current network module, named grant and generation are required.',
      );
    const { profile } = await this.site(
      m,
      agent.workspaceId,
      collector.networkId,
    );
    return { collector, profile };
  }
  async configuration(id: string, token: string, input: NetworkLocalDto) {
    return this.agents.device(id, token, async (m, agent) => {
      const { collector, profile } = await this.gate(m, agent, input);
      const router = await m
        .getRepository(NetworkRouter)
        .createQueryBuilder('r')
        .addSelect('r.encryptedCredentials')
        .where('r."networkId"=:id AND r."agentId"=:agent', {
          id: profile.networkId,
          agent: id,
        })
        .getOne();
      let safe = null;
      if (
        router?.encryptedCredentials &&
        contains(profile.cidrs, new URL(router.url).hostname)
      ) {
        const secret = decryptRouter(router.id, router.encryptedCredentials);
        safe = {
          id: router.id,
          revision: router.revision,
          adapter: router.adapter,
          url: router.url,
          interfaceName: router.interfaceName,
          caCertificate: router.caCertificate,
          ...secret,
          testRequestId:
            router.testStatus === 'pending' &&
            router.testRequestedAt &&
            Date.now() - router.testRequestedAt.getTime() < 90000
              ? router.testRequestId
              : null,
        };
      }
      return {
        schemaVersion: 1,
        networkId: profile.networkId,
        generation: agent.generation,
        revision: collector.revision,
        cidrs: profile.cidrs,
        router: safe,
        serverTime: new Date().toISOString(),
      };
    });
  }
  async pause(id: string, token: string) {
    return this.agents.device(id, token, async (m) => {
      await m.delete(NetworkSighting, { agentId: id });
      await m.update(
        NetworkCollector,
        { agentId: id },
        { observedAt: null, interfaces: [], health: 'disabled' },
      );
      return { cleared: true };
    });
  }
  async router(userId: string, wid: string, id: string, input: RouterSetupDto) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.MANAGE_NETWORKS);
      const { profile } = await this.site(m, wid, id);
      const collector = await m.findOneBy(NetworkCollector, {
        agentId: input.agentId,
        networkId: id,
        enabled: true,
      });
      if (!collector)
        throw new BadRequestException('Assign the router collector first.');
      const agent = await m.findOneByOrFail(Agent, { id: input.agentId });
      await workspacePolicy(m, agent.userId, wid, P.MANAGE_NETWORKS);
      if (collector.generation !== agent.generation || !agent.modules.network)
        throw new ForbiddenException(
          'Collector authorization must be current.',
        );
      const url = routerURL(input.url, profile.cidrs);
      if (input.caCertificate) {
        try {
          const cert = new X509Certificate(input.caCertificate);
          if (!cert.ca) throw new Error();
        } catch {
          throw new BadRequestException(
            'Provide a valid PEM CA certificate or use the operating-system trust store.',
          );
        }
      }
      let router = await m.findOneBy(NetworkRouter, { networkId: id });
      router = m.merge(
        NetworkRouter,
        router ??
          m.create(NetworkRouter, {
            id: randomUUID(),
            networkId: id,
            revision: 0,
          }),
        {
          agentId: input.agentId,
          adapter: input.adapter,
          url,
          interfaceName: input.interfaceName,
          caCertificate: input.caCertificate,
          manufacturer: input.manufacturer,
          model: input.model,
          firmware: input.firmware,
          testRequestId: null,
          testRequestedAt: null,
          testStatus: 'not_tested',
        },
      );
      router.revision++;
      router.encryptedCredentials = encryptRouter(router.id, {
        username: input.username,
        password: input.password,
      });
      await m.save(router);
      await m.increment(NetworkCollector, { networkId: id }, 'revision', 1);
      await recordNetworkEvent(
        m,
        id,
        'router_credentials_updated',
        'info',
        null,
        null,
        userId,
      );
      return publicRouter(router);
    });
  }
  async clearRouter(userId: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.MANAGE_NETWORKS);
      await this.site(m, wid, id);
      await m.delete(NetworkRouter, { networkId: id });
      await m.increment(NetworkCollector, { networkId: id }, 'revision', 1);
      await recordNetworkEvent(
        m,
        id,
        'router_removed',
        'info',
        null,
        null,
        userId,
      );
      return { removed: true };
    });
  }
  async testRouter(userId: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.MANAGE_NETWORKS);
      await this.site(m, wid, id);
      const router = await m.findOneBy(NetworkRouter, { networkId: id });
      if (!router?.agentId)
        throw new BadRequestException(
          'Configure an assigned router collector.',
        );
      router.testRequestId = randomUUID();
      router.testRequestedAt = new Date();
      router.testStatus = 'pending';
      await m.save(router);
      return {
        requestId: router.testRequestId,
        state: 'pending',
        expiresAt: new Date(Date.now() + 90000).toISOString(),
      };
    });
  }
  async snapshot(id: string, token: string, input: NetworkSnapshotDto) {
    return this.agents.device(id, token, async (m, agent) => {
      const { collector: c, profile } = await this.gate(m, agent, input);
      if (input.revision !== c.revision)
        throw new ConflictException('Network revision changed.');
      const observed = new Date(input.observedAt),
        age = Date.now() - observed.getTime();
      if (age < -5000 || age > 90000)
        throw new BadRequestException(
          'Network observation is stale or in the future.',
        );
      const hash = fingerprint(input);
      if (c.snapshotId === input.snapshotId) {
        if (c.snapshotHash !== hash)
          throw new ConflictException(
            'Snapshot ID was reused with changed content.',
          );
        return { accepted: true, replayed: true };
      }
      if (c.observedAt && observed <= c.observedAt)
        throw new ConflictException(
          'Network observations must advance source time.',
        );
      if (input.router === undefined)
        throw new BadRequestException('Router result must be present or null.');
      for (const iface of input.interfaces) {
        const p = prefix(iface.cidr);
        if (
          !contains(profile.cidrs, p.ip) ||
          (iface.gateway !== null && !contains(profile.cidrs, iface.gateway))
        )
          throw new BadRequestException(
            'Interface is outside the named private network.',
          );
      }
      await recordNeighborObservations(
        m,
        c.networkId,
        id,
        profile.cidrs,
        observed,
        input.neighbors,
      );
      if (input.router) {
        await recordRouterSample(
          m,
          c.networkId,
          id,
          input.snapshotId,
          observed,
          input.router,
        );
      }
      if (c.health === 'not_reporting')
        await recordNetworkEvent(
          m,
          c.networkId,
          'collector_recovered',
          'info',
          id,
          null,
          null,
          observed,
        );
      c.observedAt = observed;
      c.snapshotId = input.snapshotId;
      c.snapshotHash = hash;
      c.interfaces = input.interfaces;
      c.health = 'reporting';
      await m.save(c);
      return { accepted: true, replayed: false };
    });
  }
  async endpoint(
    userId: string,
    wid: string,
    id: string,
    eid: string,
    input?: EndpointUpdateDto,
  ) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.MANAGE_NETWORKS);
      await this.site(m, wid, id);
      const endpoint = await m.findOneBy(NetworkEndpoint, {
        id: eid,
        networkId: id,
      });
      if (!endpoint)
        throw new ForbiddenException('Endpoint is outside this network.');
      if (!input) {
        await m.delete(NetworkEndpoint, { id: eid });
        return { removed: true };
      }
      if (
        input.assignedUserId &&
        !(await m.existsBy(Membership, {
          userId: input.assignedUserId,
          workspaceId: wid,
        }))
      )
        throw new BadRequestException(
          'Assignment must reference a current workspace member.',
        );
      if (
        input.registeredDeviceId &&
        !(await m.existsBy(RegisteredDevice, {
          id: input.registeredDeviceId,
          workspaceId: wid,
        }))
      )
        throw new BadRequestException(
          'Device association must stay in this workspace.',
        );
      Object.assign(endpoint, input);
      await m.save(endpoint);
      await recordNetworkEvent(
        m,
        id,
        'endpoint_updated',
        'info',
        null,
        eid,
        userId,
      );
      return endpoint;
    });
  }
  async review(
    userId: string,
    wid: string,
    id: string,
    eventId: string,
    input: NetworkEventDto,
  ) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.HANDLE_ALERTS);
      await this.site(m, wid, id);
      const event = await m.findOneBy(NetworkEvent, {
        id: eventId,
        networkId: id,
      });
      if (!event)
        throw new ForbiddenException('Event is outside this network.');
      event.severity = input.severity;
      event.acknowledgedAt = input.acknowledged ? new Date() : null;
      await m.save(event);
      await recordNetworkEvent(
        m,
        id,
        'event_reviewed',
        'info',
        null,
        event.endpointId,
        userId,
      );
      return event;
    });
  }
  async compatibility(
    userId: string,
    wid: string,
    id: string,
    input: CompatibilityDto,
  ) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.MANAGE_NETWORKS);
      await this.site(m, wid, id);
      if (
        new Date(input.testedAt) > new Date() ||
        (await m.countBy(NetworkCompatibility, { networkId: id })) >= 100
      )
        throw new BadRequestException(
          'Compatibility date/record limit is invalid.',
        );
      return m.save(
        m.create(
          NetworkCompatibility,
          Object.assign({}, input, {
            networkId: id,
            authentication: 'ubus-session-verified-https',
          }),
        ),
      );
    });
  }
  private async collectorSources(m: EntityManager, wid: string, id: string) {
    const collectors = await m.findBy(NetworkCollector, { networkId: id });
    const sources = [];
    const freshIds: string[] = [];
    for (const c of collectors) {
      const agent = await m.findOneBy(Agent, { id: c.agentId });
      const member = agent
        ? await m.findOneBy(Membership, {
            workspaceId: wid,
            userId: agent.userId,
          })
        : null;
      const owner = agent
        ? await m.findOneBy(User, {
            id: agent.userId,
            status: AccountStatus.ACTIVE,
          })
        : null;
      const valid = !!(
        agent &&
        owner?.emailVerifiedAt &&
        member &&
        roleAllows(member.role, P.MANAGE_NETWORKS) &&
        agent.state === 'ACTIVE' &&
        agent.modules.network &&
        agent.generation === c.generation &&
        c.enabled
      );
      const fresh =
        valid &&
        !!c.observedAt &&
        Date.now() - c.observedAt.getTime() <= 150000 &&
        !!agent?.lastSeenAt &&
        Date.now() - agent.lastSeenAt.getTime() <= 90000;
      if (fresh) freshIds.push(c.agentId);
      sources.push({
        agentId: c.agentId,
        name: agent?.name ?? 'Unavailable agent',
        generation: c.generation,
        revision: c.revision,
        enabled: c.enabled,
        connection: fresh ? 'reporting' : valid ? 'unavailable' : 'disabled',
        observedAt: c.observedAt,
        interfaces: fresh ? c.interfaces : [],
        networkId: id,
      });
    }
    return { sources, freshIds };
  }

  private async inventoryRows(
    m: EntityManager,
    endpoints: NetworkEndpoint[],
    freshIds: string[],
  ) {
    const observations =
      freshIds.length && endpoints.length
        ? await m.findBy(NetworkSighting, {
            agentId: In(freshIds),
            endpointId: In(endpoints.map((endpoint) => endpoint.id)),
            observedAt: MoreThanOrEqual(new Date(Date.now() - 120000)),
          })
        : [];
    return endpoints.map((e) =>
      Object.assign({}, e, {
        presence: observations.some((s) => s.endpointId === e.id)
          ? 'recently_observed'
          : 'not_recently_observed',
        observations: observations
          .filter((s) => s.endpointId === e.id)
          .map((s) => ({
            agentId: s.agentId,
            address: s.address,
            evidence: s.evidence,
            observedAt: s.observedAt,
          })),
        hostname: null,
        manufacturer: null,
        identityConfidence: e.mac
          ? 'network_scoped_mac_observation'
          : 'source_scoped_address_observation',
      }),
    );
  }

  async inventoryPage(
    userId: string,
    wid: string,
    id: string,
    query: SearchPageQuery,
    includeArchived: boolean,
  ) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.READ_NETWORKS);
      await this.site(m, wid, id);
      const { freshIds } = await this.collectorSources(m, wid, id);
      const builder = m
        .createQueryBuilder(NetworkEndpoint, 'e')
        .where('e."networkId" = :id', { id });
      if (!includeArchived) builder.andWhere('NOT e.archived');
      const search = query.search?.trim();
      if (search) {
        builder.andWhere(
          `(strpos(lower(e.name || ' ' || coalesce(e.mac, '')), lower(:search)) > 0${
            freshIds.length
              ? ` OR EXISTS (
          SELECT 1 FROM network_sightings s WHERE s."endpointId" = e.id AND s."agentId" IN (:...freshIds)
          AND s."observedAt" >= :cutoff AND strpos(lower(s.address), lower(:search)) > 0
        )`
              : ''
          })`,
          { search, freshIds, cutoff: new Date(Date.now() - 120000) },
        );
      }
      const page = await selectPage(builder, query, {
        timestamp: 'firstSeenAt',
      });
      return {
        ...page,
        items: await this.inventoryRows(m, page.items, freshIds),
      };
    });
  }

  async eventPage(userId: string, wid: string, id: string, query: PageQuery) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.READ_NETWORKS);
      await this.site(m, wid, id);
      const builder = m
        .createQueryBuilder(NetworkEvent, 'e')
        .where('e."networkId" = :id', { id });
      return selectPage(builder, query, { timestamp: 'occurredAt' });
    });
  }

  async presencePage(
    userId: string,
    wid: string,
    id: string,
    endpointId: string,
    query: PageQuery,
  ) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.READ_NETWORKS);
      await this.site(m, wid, id);
      if (
        !(await m.existsBy(NetworkEndpoint, { id: endpointId, networkId: id }))
      )
        throw new ForbiddenException(
          'Observed device is outside this network.',
        );
      const builder = m
        .createQueryBuilder(NetworkPresence, 'p')
        .where('p."networkId" = :id AND p."endpointId" = :endpointId', {
          id,
          endpointId,
        });
      return selectPage(builder, query, { timestamp: 'lastObservedAt' });
    });
  }

  async view(
    userId: string,
    wid: string,
    id: string,
    from?: string,
    to?: string,
    summary = false,
  ) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(m, userId, wid, P.READ_NETWORKS);
      const { label, profile } = await this.site(m, wid, id);
      for (const value of [from, to])
        if (
          value &&
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
        )
          throw new BadRequestException(
            'Choose UTC timestamps with milliseconds.',
          );
      const end = to ? new Date(to) : new Date(),
        start = from ? new Date(from) : new Date(end.getTime() - 86400000);
      if (
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        end <= start ||
        end.getTime() - start.getTime() > 30 * 86400000 ||
        end.getTime() > Date.now() + 5000
      )
        throw new BadRequestException(
          'Choose a valid UTC range of at most thirty days.',
        );
      const { sources, freshIds } = await this.collectorSources(m, wid, id);
      const endpoints = summary
        ? []
        : await m.find(NetworkEndpoint, {
            where: { networkId: id },
            order: { firstSeenAt: 'DESC' },
            take: 2000,
          });
      const inventory = await this.inventoryRows(m, endpoints, freshIds);
      const router = await m
        .getRepository(NetworkRouter)
        .createQueryBuilder('r')
        .addSelect('r.encryptedCredentials')
        .where('r."networkId"=:id', { id })
        .getOne();
      const samples = router
        ? await m.find(NetworkSample, {
            where: { routerId: router.id },
            order: { observedAt: 'DESC' },
            take: 60,
          })
        : [];
      const latest = samples[0];
      const live = !!(
        router &&
        latest &&
        latest.revision === router.revision &&
        latest.agentId === router.agentId &&
        freshIds.includes(latest.agentId) &&
        Date.now() - latest.observedAt.getTime() <= 150000
      );
      const [totals] = router
        ? await m.query(
            `SELECT COALESCE(sum("rxDelta"),0)::text AS rx,COALESCE(sum("txDelta"),0)::text AS tx,COALESCE(sum(EXTRACT(EPOCH FROM ("observedAt"-"intervalStart"))*1000),0)::float8 AS coverage FROM network_samples WHERE "routerId"=$1 AND quality='measured' AND "intervalStart">=$2 AND "observedAt"<=$3`,
            [router.id, start, end],
          )
        : [{ rx: '0', tx: '0', coverage: 0 }];
      const history = router
        ? await m.query(
            `SELECT date_trunc('hour',"observedAt") AS at,COALESCE(sum("rxDelta"),0)::text AS rx,COALESCE(sum("txDelta"),0)::text AS tx,count(*)::int AS samples,count(*) FILTER(WHERE quality<>'measured')::int AS gaps FROM network_samples WHERE "routerId"=$1 AND "observedAt">=$2 AND "observedAt"<=$3 AND (quality<>'measured' OR "intervalStart">=$2) GROUP BY 1 ORDER BY 1`,
            [router.id, start, end],
          )
        : [];
      const rates = samples.map((s) => {
        const ms = s.intervalStart
          ? s.observedAt.getTime() - s.intervalStart.getTime()
          : 0;
        return Object.assign({}, s, {
          rxBitsPerSecond:
            ms > 0 && s.rxDelta !== null
              ? (Number(s.rxDelta) * 8000) / ms
              : null,
          txBitsPerSecond:
            ms > 0 && s.txDelta !== null
              ? (Number(s.txDelta) * 8000) / ms
              : null,
        });
      });
      const measuredRates = rates.filter(
        (s) =>
          s.quality === 'measured' &&
          s.intervalStart &&
          s.intervalStart >= start &&
          s.observedAt <= end,
      );
      const peak = measuredRates.length
        ? measuredRates.reduce(
            (v, s) =>
              Math.max(v, (s.rxBitsPerSecond ?? 0) + (s.txBitsPerSecond ?? 0)),
            0,
          )
        : null;
      return {
        networkId: id,
        name: label.name,
        cidrs: profile.cidrs,
        collectors: sources,
        endpoints: inventory,
        presenceHistory: summary
          ? []
          : await m.find(NetworkPresence, {
              where: { networkId: id },
              order: { lastObservedAt: 'DESC' },
              take: 100,
            }),
        router: publicRouter(router),
        routerHealth: live ? latest.status : 'unavailable',
        wanUp: live ? latest.wanUp : null,
        reportedAt: live ? latest.observedAt : null,
        bandwidth: {
          from: start.toISOString(),
          to: end.toISOString(),
          receivedBytes: totals.rx,
          sentBytes: totals.tx,
          coverageMs: Math.min(
            end.getTime() - start.getTime(),
            totals.coverage,
          ),
          missingMs: Math.max(
            0,
            end.getTime() - start.getTime() - totals.coverage,
          ),
          peakRecentBitsPerSecond: peak,
          samples: rates,
          history,
        },
        events: summary
          ? []
          : await m.find(NetworkEvent, {
              where: { networkId: id },
              order: { occurredAt: 'DESC' },
              take: 100,
            }),
        compatibility: await m.find(NetworkCompatibility, {
          where: { networkId: id },
          order: { testedAt: 'DESC' },
          take: 100,
        }),
        adapterProfiles,
        limitations: [
          'Passive IPv4 neighbors are incomplete and may be cached; absence is not proof of being offline.',
          'MAC/IP observations do not verify a person or hardware identity. No automatic ownership merge or policy grant.',
          'WAN counters belong to one assigned router source; no per-device bandwidth is inferred. Counter reset, revision change and long gaps do not create usage.',
          'Router API/link health does not prove public internet reachability. Hardware/firmware compatibility remains unverified unless separately tested.',
          'Blocked/trusted categories are labels, not enforcement. New endpoints may be rediscovered after deletion while collection remains enabled.',
          'Hourly counters are attributed by interval end; totals include whole confirmed intervals only. Peak is from the latest sixty samples inside the selected range.',
        ],
      };
    });
  }
}
