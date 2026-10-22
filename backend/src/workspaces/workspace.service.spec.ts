import { ConflictException } from '@nestjs/common';
import { DevicePlatform } from './registered-device.entity';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  it('does not let a member take over a device registered elsewhere', async () => {
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
    );

    await expect(
      service.registerDevice('user-1', {
        workspaceId: '79a3fa84-4690-4fb7-90af-09f69777021d',
        installationId: 'install-1',
        name: 'Pixel',
        platform: DevicePlatform.ANDROID,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(devices.save).not.toHaveBeenCalled();
  });
});
