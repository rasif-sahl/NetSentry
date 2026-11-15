import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership, WorkspaceRole } from './membership.entity';

export enum WorkspacePermission {
  READ = 'workspace:read',
  READ_DEVICES = 'devices:read',
  REGISTER_DEVICE = 'devices:register',
  VIEW_SERVICES = 'services:view',
  CONTROL_SERVICES = 'services:control',
}

const readPermissions = [
  WorkspacePermission.READ,
  WorkspacePermission.READ_DEVICES,
  WorkspacePermission.VIEW_SERVICES,
];
const grants: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  [WorkspaceRole.OWNER]: Object.values(WorkspacePermission),
  [WorkspaceRole.ADMIN]: Object.values(WorkspacePermission),
  [WorkspaceRole.GUARDIAN]: [
    ...readPermissions,
    WorkspacePermission.REGISTER_DEVICE,
  ],
  [WorkspaceRole.MEMBER]: [
    ...readPermissions,
    WorkspacePermission.REGISTER_DEVICE,
  ],
  [WorkspaceRole.VIEWER]: readPermissions,
};

export function roleAllows(
  role: WorkspaceRole,
  permission: WorkspacePermission,
): boolean {
  return Object.hasOwn(grants, role) && grants[role].includes(permission);
}

@Injectable()
export class WorkspaceAccessService {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
  ) {}

  async assertPermission(
    userId: string,
    workspaceId: string,
    permission: WorkspacePermission,
  ): Promise<void> {
    const membership = await this.memberships.findOneBy({
      userId,
      workspaceId,
    });
    if (!membership || !roleAllows(membership.role, permission)) {
      throw new ForbiddenException(
        'You do not have permission for this workspace action.',
      );
    }
    // Future service commands also require device-specific pairing/control grants,
    // an enabled module and a supported action. A workspace gate alone is insufficient.
  }
}
