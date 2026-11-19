import type { EntityManager } from 'typeorm';
import {
  FamilyProfile,
  FamilyAssignment,
  FamilyRequest,
  FamilyEvent,
} from '../entity/family.entities';
export async function eraseFamilyUser(m: EntityManager, userId: string) {
  await m.delete(FamilyProfile, { userId });
  await m.delete(FamilyRequest, { requesterId: userId });
  await m.delete(FamilyEvent, { actorId: userId });
  await m.query(
    'UPDATE family_profiles SET guardians=guardians-$1,revision=revision+1 WHERE guardians ? $1',
    [userId],
  );
}
export async function exportFamilyUser(
  m: EntityManager,
  userId: string,
  deviceIds: string[],
) {
  return {
    profiles: await m.find(FamilyProfile, {
      where: { userId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        avatar: true,
        ageBand: true,
        userId: true,
        archived: true,
        revision: true,
        createdAt: true,
      },
    }),
    assignments: deviceIds.length
      ? await m
          .getRepository(FamilyAssignment)
          .createQueryBuilder('a')
          .where('a."deviceId" IN (:...ids)', { ids: deviceIds })
          .getMany()
      : [],
    requests: await m.findBy(FamilyRequest, { requesterId: userId }),
    events: await m.findBy(FamilyEvent, { actorId: userId }),
  };
}
