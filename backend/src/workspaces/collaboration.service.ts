import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { hashToken } from '../auth/account-actions.service';
import { RegisteredDevice } from './registered-device.entity';
import { DeviceEnrolment } from '../devices/enrolment.entity';
import { DeviceEvent } from '../devices/device-event.entity';
import { User, AccountStatus } from '../users/user.entity';
import { Membership, WorkspaceRole } from './membership.entity';
import { Workspace, WorkspaceType } from './workspace.entity';
import { WorkspaceInvitation } from './invitation.entity';
import { workspacePolicy } from './workspace-policy';
import { WorkspacePermission, roleAllows } from './workspace-access.service';
import { InvitationDto } from './dto/collaboration.dto';

@Injectable()
export class CollaborationService {
  constructor(private readonly source: DataSource) {}

  async invite(userId: string, workspaceId: string, input: InvitationDto) {
    return this.source.transaction(async (manager) => {
      const { workspace, member } = await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.MANAGE_MEMBERS,
      );
      if (workspace.type === WorkspaceType.PERSONAL)
        throw new ForbiddenException(
          'Personal workspaces cannot invite members.',
        );
      this.checkGrant(member.role, input.role, workspace.type);
      const email = input.email.trim().toLowerCase();
      await manager.update(
        WorkspaceInvitation,
        { workspaceId, email, acceptedAt: IsNull(), revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      const token = randomBytes(32).toString('base64url');
      const invitation = await manager.save(
        manager.create(WorkspaceInvitation, {
          workspaceId,
          createdById: userId,
          email,
          role: input.role,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        }),
      );
      return { invitation: this.publicInvitation(invitation), token };
    });
  }

  async invitations(userId: string, workspaceId: string) {
    return this.source.transaction(async (manager) => {
      await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.MANAGE_MEMBERS,
      );
      return (
        await manager.find(WorkspaceInvitation, {
          where: { workspaceId },
          order: { createdAt: 'DESC' },
        })
      ).map((invitation) => this.publicInvitation(invitation));
    });
  }

  async revokeInvitation(
    userId: string,
    workspaceId: string,
    invitationId: string,
  ) {
    await this.source.transaction(async (manager) => {
      await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.MANAGE_MEMBERS,
      );
      await manager.update(
        WorkspaceInvitation,
        { id: invitationId, workspaceId, acceptedAt: IsNull() },
        { revokedAt: new Date() },
      );
    });
    return { revoked: true };
  }

  async accept(userId: string, token: string) {
    return this.source.transaction(async (manager) => {
      const candidate = await manager.findOneBy(WorkspaceInvitation, {
        tokenHash: hashToken(token),
      });
      if (!candidate)
        throw new BadRequestException('Invitation is invalid or has expired.');
      const workspace = await manager.findOne(Workspace, {
        where: { id: candidate.workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      const user = await manager.findOneBy(User, {
        id: userId,
        status: AccountStatus.ACTIVE,
      });
      const invitation = await manager.findOne(WorkspaceInvitation, {
        where: { id: candidate.id },
        lock: { mode: 'pessimistic_write' },
      });
      const invitingUser = await manager.findOneBy(User, {
        id: candidate.createdById,
        status: AccountStatus.ACTIVE,
      });
      const creator = await manager.findOneBy(Membership, {
        workspaceId: candidate.workspaceId,
        userId: candidate.createdById,
      });
      if (
        !workspace ||
        workspace.type === WorkspaceType.PERSONAL ||
        !user?.emailVerifiedAt ||
        !invitation ||
        invitation.acceptedAt ||
        invitation.revokedAt ||
        invitation.expiresAt <= new Date() ||
        invitation.email !== user.email ||
        !invitingUser?.emailVerifiedAt ||
        !creator ||
        !roleAllows(creator.role, WorkspacePermission.MANAGE_MEMBERS)
      )
        throw new BadRequestException('Invitation is invalid or has expired.');
      this.checkGrant(creator.role, invitation.role, workspace.type);
      if (
        await manager.existsBy(Membership, {
          userId,
          workspaceId: workspace.id,
        })
      )
        throw new ConflictException('You already belong to this workspace.');
      await manager.save(
        manager.create(Membership, {
          userId,
          workspaceId: workspace.id,
          role: invitation.role,
        }),
      );
      invitation.acceptedAt = new Date();
      await manager.save(invitation);
      return { joined: true, workspaceId: workspace.id };
    });
  }

  async select(userId: string, workspaceId: string) {
    return this.source.transaction(async (manager) => {
      const { workspace, member } = await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.READ,
        false,
      );
      await manager.query(
        `UPDATE users SET preferences = preferences || jsonb_build_object('activeWorkspaceId', $2::text), "updatedAt"=now() WHERE id=$1`,
        [userId, workspaceId],
      );
      return {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        timezone: workspace.timezone,
        role: member.role,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
    });
  }

  async members(userId: string, workspaceId: string) {
    return this.source.transaction(async (manager) => {
      await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.READ,
        false,
      );
      return (
        await manager.find(Membership, {
          where: { workspaceId },
          relations: { user: true },
          order: { createdAt: 'ASC' },
        })
      ).map((member) => ({
        userId: member.userId,
        role: member.role,
        displayName: member.user.displayName,
        email: member.user.email,
      }));
    });
  }

  async permissions(userId: string, workspaceId: string) {
    return this.source.transaction(async (manager) => {
      const { member } = await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.READ,
        false,
      );
      return {
        workspaceId,
        role: member.role,
        permissions: Object.values(WorkspacePermission).filter((permission) =>
          roleAllows(member.role, permission),
        ),
      };
    });
  }

  async changeMember(
    userId: string,
    workspaceId: string,
    targetId: string,
    role?: WorkspaceRole,
  ) {
    await this.source.transaction(async (manager) => {
      const { workspace, member } = await workspacePolicy(
        manager,
        userId,
        workspaceId,
        role === undefined && userId === targetId
          ? WorkspacePermission.READ
          : WorkspacePermission.MANAGE_MEMBERS,
      );
      const target = await manager.findOneBy(Membership, {
        workspaceId,
        userId: targetId,
      });
      if (!target) throw new ForbiddenException('Member is not available.');
      if (target.role === WorkspaceRole.OWNER)
        throw new ConflictException(
          'Transfer ownership before leaving or changing the owner.',
        );
      if (role && userId === targetId)
        throw new ForbiddenException('You cannot change your own role.');
      if (
        userId !== targetId &&
        member.role !== WorkspaceRole.OWNER &&
        [WorkspaceRole.ADMIN, WorkspaceRole.GUARDIAN].includes(target.role)
      )
        throw new ForbiddenException('Only the owner can change this member.');
      if (role) {
        this.checkGrant(member.role, role, workspace.type);
        target.role = role;
        await manager.save(target);
      } else {
        await manager.delete(Membership, target.id);
        await manager.query(
          `UPDATE users SET preferences=preferences - 'activeWorkspaceId' WHERE id=$1 AND preferences->>'activeWorkspaceId'=$2`,
          [targetId, workspaceId],
        );
      }
      const targetUser = await manager.findOneBy(User, { id: targetId });
      if (targetUser)
        await manager.update(
          WorkspaceInvitation,
          {
            workspaceId,
            email: targetUser.email,
            acceptedAt: IsNull(),
            revokedAt: IsNull(),
          },
          { revokedAt: new Date() },
        );
      if (!role || !roleAllows(role, WorkspacePermission.REGISTER_DEVICE)) {
        const devices = await manager.find(RegisteredDevice, {
          where: { workspaceId, registeredById: targetId, removedAt: IsNull() },
        });
        for (const device of devices) {
          device.monitoringEnabled = false;
          device.consentScopes = [];
          device.credentialHash = null;
          device.state = 'REVOKED';
          device.revokedAt = new Date();
          device.generation++;
          await manager.save(device);
          await manager.save(
            manager.create(DeviceEvent, {
              deviceId: device.id,
              actorUserId: userId,
              kind: 'membership_revoked',
              generation: device.generation,
              details: {},
            }),
          );
        }
        await manager.update(
          DeviceEnrolment,
          { workspaceId, userId: targetId, consumedAt: IsNull() },
          { consumedAt: new Date() },
        );
      }
      await manager.update(
        WorkspaceInvitation,
        {
          workspaceId,
          createdById: targetId,
          acceptedAt: IsNull(),
          revokedAt: IsNull(),
        },
        { revokedAt: new Date() },
      );
    });
    return role ? { updated: true } : { removed: true };
  }

  async transfer(userId: string, workspaceId: string, targetId: string) {
    await this.source.transaction(async (manager) => {
      const { workspace, member } = await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.MANAGE_MEMBERS,
      );
      if (
        workspace.type === WorkspaceType.PERSONAL ||
        member.role !== WorkspaceRole.OWNER ||
        targetId === userId
      )
        throw new ForbiddenException(
          'Only shared-workspace owners can transfer ownership to another member.',
        );
      const target = await manager.findOneBy(Membership, {
        workspaceId,
        userId: targetId,
      });
      const user = await manager.findOneBy(User, {
        id: targetId,
        status: AccountStatus.ACTIVE,
      });
      if (!target || !user?.emailVerifiedAt)
        throw new BadRequestException('Choose a verified active member.');
      member.role = WorkspaceRole.ADMIN;
      target.role = WorkspaceRole.OWNER;
      workspace.ownerId = targetId;
      await manager.save([member, target]);
      await manager.save(workspace);
      await manager.update(
        WorkspaceInvitation,
        {
          workspaceId,
          createdById: userId,
          acceptedAt: IsNull(),
          revokedAt: IsNull(),
        },
        { revokedAt: new Date() },
      );
    });
    return { transferred: true };
  }

  private checkGrant(
    actor: WorkspaceRole,
    role: WorkspaceRole,
    type: WorkspaceType,
  ) {
    if (
      role === WorkspaceRole.OWNER ||
      (role === WorkspaceRole.ADMIN && actor !== WorkspaceRole.OWNER) ||
      (role === WorkspaceRole.GUARDIAN &&
        (actor !== WorkspaceRole.OWNER || type !== WorkspaceType.FAMILY))
    )
      throw new ForbiddenException(
        'This role requires the appropriate workspace owner.',
      );
  }
  private publicInvitation(invitation: WorkspaceInvitation) {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      role: invitation.role,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt ?? null,
      revokedAt: invitation.revokedAt ?? null,
    };
  }
}
