import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Channel } from './alert.entities';
class QuietHoursDto {
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) start!: string;
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) end!: string;
  @IsTimeZone() timezone!: string;
}
export class AlertRuleDto {
  @IsIn(['threshold', 'device_offline', 'permission_revoked', 'not_reporting'])
  kind!:
    'threshold' | 'device_offline' | 'permission_revoked' | 'not_reporting';
  @IsOptional()
  @IsIn([
    'mobile_data_bytes',
    'wifi_data_bytes',
    'screen_time_seconds',
    'application_foreground_seconds',
  ])
  metric?: string;
  @IsOptional() @IsString() @MaxLength(255) applicationId?: string;
  @IsOptional() @IsIn(['measured', 'estimated']) quality?:
    'measured' | 'estimated';
  @IsOptional() @IsUUID() deviceId?: string;
  @IsOptional() @IsUUID() networkId?: string;
  @IsIn(['day', 'week', 'month']) period!: 'day' | 'week' | 'month';
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  @Max(9007199254)
  threshold!: number;
  @IsIn(['info', 'warning', 'critical']) severity!:
    'info' | 'warning' | 'critical';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(['in_app', 'android_push', 'ios_push'], { each: true })
  channels!: Channel[];
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;
  @IsBoolean() enabled!: boolean;
}
export class NotificationPreferenceDto {
  @IsBoolean() inApp!: boolean;
  @IsBoolean() push!: boolean;
}
