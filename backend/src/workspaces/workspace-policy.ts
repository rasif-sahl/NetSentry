import { ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { User, AccountStatus } from '../users/user.entity';
import { Workspace } from './workspace.entity';
import { Membership } from './membership.entity';
import { roleAllows, WorkspacePermission } from './workspace-access.service';

export async function workspacePolicy(
  manager: EntityManager,
  userId: string,
  workspaceId: string,
  permission: WorkspacePermission,
  verified = true,
) {
  const workspace = await manager.findOne(Workspace, {
    where: { id: workspaceId },
    lock: { mode: 'pessimistic_write' },
  });
  const member = await manager.findOneBy(Membership, { workspaceId, userId });
  const user = await manager.findOneBy(User, {
    id: userId,
    status: AccountStatus.ACTIVE,
  });
  if (
    !workspace ||
    !member ||
    !user ||
    !roleAllows(member.role, permission) ||
    (['NETWORK_ADMIN', 'ANALYST', 'EMPLOYEE'].includes(member.role) &&
      workspace.type !== 'BUSINESS')
  )
    throw new ForbiddenException(
      'You do not have permission for this workspace action.',
    );
  if (verified && !user.emailVerifiedAt)
    throw new ForbiddenException(
      'Verify your email before managing workspace access or enrolling devices.',
    );
  return { workspace, member, user };
}
