import { ForbiddenException } from '@nestjs/common';
import { DevicePlatform } from '../entity/registered-device.entity';
import { WorkspaceService } from '../workspace.service';

describe('WorkspaceService', () => {
  it('does not query devices or persist changes when access is denied', async () => {
    const devices = { find: jest.fn(), findOneBy: jest.fn(), save: jest.fn() };
    const access = {
      assertPermission: jest.fn().mockRejectedValue(new ForbiddenException()),
    };
    const service = new WorkspaceService(
      {} as never,
      {} as never,
      devices as never,
      {} as never,
      access as never,
    );
    await expect(
      service.listDevices('outsider', 'workspace'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.registerDevice('outsider', {
        workspaceId: 'workspace',
        installationId: 'install',
        name: 'Fixture',
        platform: DevicePlatform.ANDROID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(devices.find).not.toHaveBeenCalled();
    expect(devices.findOneBy).not.toHaveBeenCalled();
    expect(devices.save).not.toHaveBeenCalled();
  });

  it('does not let authorized clients bypass one-time device enrolment', async () => {
    const memberships = { exists: jest.fn().mockResolvedValue(true) };
    const devices = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'device-1',
        installationId: 'install-1',
        workspaceId: 'workspace-other',
        registeredById: 'user-other',
      }),
      save: jest.fn(),
    };
    const service = new WorkspaceService(
      {} as never,
      memberships as never,
      devices as never,
      {} as never,
      { assertPermission: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(
      service.registerDevice('user-1', {
        workspaceId: '79a3fa84-4690-4fb7-90af-09f69777021d',
        installationId: 'install-1',
        name: 'Pixel',
        platform: DevicePlatform.ANDROID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(devices.save).not.toHaveBeenCalled();
  });
});
