import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
} from 'class-validator';
import { DevicePlatform } from '../../workspaces/entity/registered-device.entity';
import { ActionTokenDto } from '../../auth/dto/account.dto';
export class EnrolmentRequestDto {
  @IsUUID() workspaceId!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  @Matches(/\S/)
  installationId!: string;
  @IsEnum(DevicePlatform) platform!: DevicePlatform;
}
export class RedeemEnrolmentDto extends ActionTokenDto {
  @IsString() @MinLength(1) @MaxLength(100) @Matches(/\S/) name!: string;
  @IsIn(['device-enrolment-v1']) disclosureVersion!: string;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
}
export class RenameDeviceDto {
  @IsString() @MinLength(1) @MaxLength(100) @Matches(/\S/) name!: string;
}
export class ConsentDto {
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(['app-usage-v1'])
  appUsageDisclosureVersion?: string;
  @IsIn(['monitoring-v3']) disclosureVersion!: string;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(['network_usage', 'app_usage'], { each: true })
  scopes!: string[];
}
export class DeviceHealthDto {
  @IsInt() @Min(1) generation!: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  applicationVersion?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  deviceModel?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  operatingSystemVersion?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(['unknown', 'restricted', 'unrestricted', 'not_applicable'])
  batteryOptimizationStatus?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(['unknown', 'granted', 'denied', 'revoked'])
  permissionStatus?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsIn([
    'unknown',
    'healthy',
    'permission_required',
    'battery_setup_required',
    'offline',
  ])
  monitoringHealth?: string;
  @ValidateIf((_, v) => v !== undefined) @IsObject() capabilityReport?: Record<
    string,
    unknown
  >;
}
