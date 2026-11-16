import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FamilyProfile } from './family.entities';
import { workspacePolicy } from '../workspaces/workspace-policy';
import { WorkspacePermission as P } from '../workspaces/workspace-access.service';
import { Membership } from '../workspaces/membership.entity';
import { User, AccountStatus } from '../users/user.entity';
export async function familyScope(
  m: EntityManager,
  userId: string,
  wid: string,
  profileId?: string,
  manage = false,
) {
  const { workspace, member } = await workspacePolicy(m, userId, wid, P.READ);
  if (workspace.type !== 'FAMILY')
    throw new ForbiddenException('Choose a Family workspace.');
  const elevated = ['OWNER', 'ADMIN'].includes(member.role);
  const profiles = await m.findBy(FamilyProfile, {
    workspaceId: wid,
    ...(profileId ? { id: profileId } : {}),
  });
  const scoped = profiles.filter(
    (p) =>
      elevated ||
      (member.role === 'GUARDIAN' && p.guardians.includes(userId)) ||
      (!manage && p.userId === userId && member.role === 'MEMBER'),
  );
  if (profileId && (!scoped.length || (manage && scoped[0].archived)))
    throw new ForbiddenException(
      'Profile is outside your current family grant.',
    );
  return { workspace, member, profiles: scoped, elevated };
}
export async function familyAuthor(
  m: EntityManager,
  p: FamilyProfile,
  id: string | null,
) {
  if (!id) return false;
  const member = await m.findOneBy(Membership, {
      workspaceId: p.workspaceId,
      userId: id,
    }),
    user = await m.findOneBy(User, { id, status: AccountStatus.ACTIVE });
  return !!(
    user?.emailVerifiedAt &&
    member &&
    (['OWNER', 'ADMIN'].includes(member.role) ||
      (member.role === 'GUARDIAN' && p.guardians.includes(id))) &&
    !p.archived
  );
}
