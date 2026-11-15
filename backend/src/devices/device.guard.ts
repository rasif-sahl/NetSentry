import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isUUID } from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { Membership } from '../workspaces/membership.entity';
import { AccountStatus } from '../users/user.entity';
import { hashToken } from '../auth/account-actions.service';
import {
  roleAllows,
  WorkspacePermission,
} from '../workspaces/workspace-access.service';
export type DeviceRequest = Request & { monitoringDevice: RegisteredDevice };
@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private readonly source: DataSource) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<DeviceRequest>();
    const id = request.params.deviceId;
    if (typeof id !== 'string' || !isUUID(id))
      throw new BadRequestException('Invalid device identifier.');
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException('Device credentials are required.');
    const device = await this.source
      .getRepository(RegisteredDevice)
      .createQueryBuilder('device')
      .addSelect('device.credentialHash')
      .leftJoinAndSelect('device.registeredBy', 'owner')
      .where('device.id = :id', { id })
      .getOne();
    const membership = device
      ? await this.source.getRepository(Membership).findOneBy({
          workspaceId: device.workspaceId,
          userId: device.registeredById,
        })
      : null;
    if (
      !device ||
      device.state !== 'ACTIVE' ||
      device.revokedAt ||
      device.removedAt ||
      device.registeredBy.status !== AccountStatus.ACTIVE ||
      !device.registeredBy.emailVerifiedAt ||
      !device.credentialHash ||
      !/^[a-f0-9]{64}$/.test(device.credentialHash) ||
      !membership ||
      !roleAllows(membership.role, WorkspacePermission.REGISTER_DEVICE) ||
      !timingSafeEqual(
        Buffer.from(hashToken(token)),
        Buffer.from(device.credentialHash),
      )
    )
      throw new UnauthorizedException(
        'Device credentials are expired or revoked.',
      );
    request.monitoringDevice = device;
    return true;
  }
}
