import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class UsageQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @IsOptional() @IsIn(['day', 'week', 'month']) period:
    'day' | 'week' | 'month' = 'day';
  @IsIn([
    'mobile_data_bytes',
    'wifi_data_bytes',
    'screen_time_seconds',
    'application_foreground_seconds',
  ])
  metric!: string;
  @IsOptional() @IsString() @MaxLength(255) applicationId?: string;
  @IsOptional() @IsUUID() deviceId?: string;
  @IsOptional() @IsUUID() networkId?: string;
}
export class RetentionDto {
  @IsInt() @Min(1) @Max(90) rawDays!: number;
  @IsInt() @Min(1) @Max(730) aggregateDays!: number;
  @IsInt() @Min(1) @Max(90) alertDays!: number;
  @IsInt() @Min(1) @Max(30) diagnosticDays!: number;
}
export class NetworkDto {
  @IsString() @Matches(/\S/) @MaxLength(100) name!: string;
}
export class NetworkAssignmentDto {
  @IsUUID() deviceId!: string;
  @IsUUID() networkId!: string;
}
