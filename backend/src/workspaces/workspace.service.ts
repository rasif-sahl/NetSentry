import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    await this.assertMember(userId, workspaceId);
    return this.devices.find({
      where: { workspaceId },
      order: { updatedAt: 'DESC' },
    });
  }

  async registerDevice(userId: string, input: RegisterDeviceDto) {
    await this.assertMember(userId, input.workspaceId);
    const existing = await this.devices.findOneBy({
      installationId: input.installationId,
    });
    if (
      existing &&
      (existing.workspaceId !== input.workspaceId ||
        existing.registeredById !== userId)
    ) {
      throw new ConflictException(
        'This device installation is already registered elsewhere.',
      );
    }
    const values = {
      installationId: input.installationId,
      workspaceId: input.workspaceId,
      name: input.name,
      platform: input.platform,
      registeredById: userId,
      operatingSystemVersion: input.operatingSystemVersion ?? null,
      capabilities: input.capabilities ?? {},
      lastSeenAt: new Date(),
    };
    return this.devices.save(
      existing
        ? this.devices.merge(existing, values)
        : this.devices.create(values),
    );
  }

  private async assertMember(userId: string, workspaceId: string) {
    if (!(await this.memberships.exists({ where: { userId, workspaceId } }))) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }
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
