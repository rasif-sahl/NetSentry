import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership, WorkspaceRole } from './entity/membership.entity';

export enum WorkspacePermission {
  READ = 'workspace:read',
  READ_REPORTS = 'reports:read',
  MANAGE_MEMBERS = 'members:manage',
  MANAGE_DEVICES = 'devices:manage',
  READ_NETWORKS = 'networks:read',
  MANAGE_NETWORKS = 'networks:manage',
  MANAGE_POLICIES = 'policies:manage',
  HANDLE_ALERTS = 'alerts:handle',
  READ_AUDIT = 'audit:read',
  MANAGE_BILLING = 'billing:manage',
  EXPORT_REPORTS = 'reports:export',
  READ_DEVICES = 'devices:read',
  REGISTER_DEVICE = 'devices:register',
  VIEW_SERVICES = 'services:view',
  CONTROL_SERVICES = 'services:control',
}

const readPermissions = [
  WorkspacePermission.READ,
  WorkspacePermission.READ_DEVICES,
  WorkspacePermission.READ_NETWORKS,
  WorkspacePermission.VIEW_SERVICES,
];
const grants: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  [WorkspaceRole.NETWORK_ADMIN]: [
    WorkspacePermission.REGISTER_DEVICE,
    WorkspacePermission.READ,
    WorkspacePermission.READ_DEVICES,
    WorkspacePermission.READ_NETWORKS,
    WorkspacePermission.MANAGE_NETWORKS,
    WorkspacePermission.HANDLE_ALERTS,
    WorkspacePermission.READ_AUDIT,
  ],
  [WorkspaceRole.ANALYST]: [
    ...readPermissions,
    WorkspacePermission.READ_REPORTS,
    WorkspacePermission.EXPORT_REPORTS,
    WorkspacePermission.READ_AUDIT,
  ],
  [WorkspaceRole.EMPLOYEE]: [
    WorkspacePermission.READ,
    WorkspacePermission.READ_DEVICES,
    WorkspacePermission.REGISTER_DEVICE,
  ],
  [WorkspaceRole.OWNER]: Object.values(WorkspacePermission),
  [WorkspaceRole.ADMIN]: Object.values(WorkspacePermission).filter(
    (permission) => permission !== WorkspacePermission.MANAGE_BILLING,
  ),
  [WorkspaceRole.GUARDIAN]: [
    ...readPermissions,
    WorkspacePermission.READ_REPORTS,
    WorkspacePermission.MANAGE_POLICIES,
    WorkspacePermission.HANDLE_ALERTS,
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
