import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  WorkspaceAccessService,
  WorkspacePermission,
} from './workspace-access.service';
import { publicDevice } from '../devices/public-device';
import { User, AccountStatus } from '../users/user.entity';
import { CreateWorkspaceDto, RegisterDeviceDto } from './dto/workspace.dto';
import { Membership, WorkspaceRole } from './membership.entity';
import { RegisteredDevice } from './registered-device.entity';
import { Workspace, WorkspaceType } from './workspace.entity';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaces: Repository<Workspace>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(RegisteredDevice)
    private readonly devices: Repository<RegisteredDevice>,
    private readonly dataSource: DataSource,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(userId: string) {
    const memberships = await this.memberships.find({
      where: { userId },
      relations: { workspace: true },
      order: { createdAt: 'ASC' },
    });
    return memberships.map(({ workspace, role }) =>
      this.workspaceResponse(workspace, role),
    );
  }

  async create(userId: string, input: CreateWorkspaceDto) {
    if (input.type === WorkspaceType.PERSONAL) {
      throw new ForbiddenException(
        'Personal workspaces are created at signup.',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneBy(User, {
        id: userId,
        status: AccountStatus.ACTIVE,
      });
      if (!user?.emailVerifiedAt)
        throw new ForbiddenException(
          'Verify your email before creating a shared workspace.',
        );
      const workspace = await manager.save(
        manager.create(Workspace, {
          name: input.name.trim(),
          type: input.type,
          ownerId: userId,
          timezone: input.timezone ?? 'UTC',
        }),
      );
      await manager.save(
        manager.create(Membership, {
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER,
        }),
      );
      return this.workspaceResponse(workspace, WorkspaceRole.OWNER);
    });
  }

  async listDevices(userId: string, workspaceId: string) {
    await this.access.assertPermission(
      userId,
      workspaceId,
      WorkspacePermission.READ_DEVICES,
    );
    const workspace = await this.workspaces.findOneBy({ id: workspaceId });
    const member = await this.memberships.findOneBy({ workspaceId, userId });
    return (
      await this.devices.find({
        where: {
          workspaceId,
          removedAt: IsNull(),
          ...(workspace?.type === WorkspaceType.BUSINESS &&
          [WorkspaceRole.EMPLOYEE, WorkspaceRole.MEMBER].includes(member!.role)
            ? { registeredById: userId }
            : {}),
        },
        order: { updatedAt: 'DESC' },
      })
    ).map(publicDevice);
  }

  async registerDevice(userId: string, input: RegisterDeviceDto) {
    await this.access.assertPermission(
      userId,
      input.workspaceId,
      WorkspacePermission.REGISTER_DEVICE,
    );
    throw new ForbiddenException(
      'Create and redeem a one-time enrolment code through /devices/enrol.',
    );
  }

  private workspaceResponse(workspace: Workspace, role: WorkspaceRole) {
    return {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      timezone: workspace.timezone,
      role,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }
}
