import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DevicePlatform } from '../registered-device.entity';
import { WorkspaceType } from '../workspace.entity';

export class CreateWorkspaceDto {
  @IsString() @MaxLength(100) name!: string;
  @IsEnum(WorkspaceType) type!: WorkspaceType;
  @IsOptional() @IsString() timezone?: string;
}

export class RegisterDeviceDto {
  @IsUUID() workspaceId!: string;
  @IsString() @MaxLength(180) installationId!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsEnum(DevicePlatform) platform!: DevicePlatform;
  @IsOptional() @IsString() operatingSystemVersion?: string;
  @IsOptional() @IsObject() capabilities?: Record<string, boolean>;
}
