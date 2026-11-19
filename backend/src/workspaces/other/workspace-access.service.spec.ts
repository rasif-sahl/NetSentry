import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole } from '../entity/membership.entity';
import {
  roleAllows,
  WorkspaceAccessService,
  WorkspacePermission,
} from '../workspace-access.service';

describe('workspace permission boundaries', () => {
  it.each([WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.GUARDIAN])(
    'does not give %s service control through viewing rights',
    (role) => {
      expect(roleAllows(role, WorkspacePermission.VIEW_SERVICES)).toBe(true);
      expect(roleAllows(role, WorkspacePermission.CONTROL_SERVICES)).toBe(
        false,
      );
    },
  );
  it('keeps a viewer read-only and denies unknown roles', () => {
    expect(
      roleAllows(WorkspaceRole.VIEWER, WorkspacePermission.READ_DEVICES),
    ).toBe(true);
    expect(
      roleAllows(WorkspaceRole.VIEWER, WorkspacePermission.REGISTER_DEVICE),
    ).toBe(false);
    expect(
      roleAllows('unknown' as WorkspaceRole, WorkspacePermission.READ),
    ).toBe(false);
  });
  it('requires membership in the exact requested workspace, including for an owner elsewhere', async () => {
    const memberships = { findOneBy: jest.fn().mockResolvedValue(null) };
    const access = new WorkspaceAccessService(memberships as never);
    await expect(
      access.assertPermission(
        'user-1',
        'workspace-other',
        WorkspacePermission.CONTROL_SERVICES,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberships.findOneBy).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-other',
    });
  });
  it('denies a viewer registration while allowing device reads', async () => {
    const access = new WorkspaceAccessService({
      findOneBy: jest.fn().mockResolvedValue({ role: WorkspaceRole.VIEWER }),
    } as never);
    await expect(
      access.assertPermission(
        'user',
        'workspace',
        WorkspacePermission.READ_DEVICES,
      ),
    ).resolves.toBeUndefined();
    await expect(
      access.assertPermission(
        'user',
        'workspace',
        WorkspacePermission.REGISTER_DEVICE,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
