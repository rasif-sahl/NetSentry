import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateBy,
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
  @IsOptional()
  @IsObject()
  @ValidateBy({
    name: 'booleanCapabilities',
    validator: {
      validate: (value: unknown) =>
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.values(value).every((entry) => typeof entry === 'boolean'),
    },
  })
  capabilities?: Record<string, boolean>;
}
