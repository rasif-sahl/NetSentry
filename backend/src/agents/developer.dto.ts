import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class DeveloperPolicyDto {
  @IsBoolean() sharingAllowed!: boolean;
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  controllers!: string[];
  @IsIn([true]) accepted!: boolean;
  @IsIn(['developer-sharing-v1']) disclosureVersion!: string;
}
export class RemoteServiceDto {
  @Matches(/^[a-f0-9]{64}$/) serviceId!: string;
  @IsUUID() observationId!: string;
  @IsInt() @Min(2) @Max(2147483647) pid!: number;
  @IsISO8601({ strict: true }) @Matches(/\.\d{3}Z$/) startedAt!: string;
  @IsISO8601({ strict: true }) @Matches(/\.\d{3}Z$/) observedAt!: string;
  @IsString() @MaxLength(30) @Matches(/^[^\p{Cc}]+$/u) runtime!: string;
  @IsString() @MaxLength(100) @Matches(/^[^\p{Cc}]+$/u) project!: string;
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(65535, { each: true })
  ports!: number[];
  @IsBoolean() canStop!: boolean;
  @IsInt() @Min(0) @Max(8192) childCount!: number;
}
export class DeveloperSnapshotDto {
  @IsIn([1]) schemaVersion!: number;
  @IsInt() @Min(1) generation!: number;
  @IsInt() @Min(1) revision!: number;
  @IsBoolean() localControlReady!: boolean;
  @IsBoolean() platformSupported!: boolean;
  @IsInt() @Min(0) @Max(256) total!: number;
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => RemoteServiceDto)
  services!: RemoteServiceDto[];
}
export class RemoteCommandDto {
  @IsUUID() requestId!: string;
  @Matches(/^[a-f0-9]{64}$/) serviceId!: string;
  @IsUUID() observationId!: string;
  @IsIn(['graceful', 'force']) mode!: string;
  @IsBoolean() includeChildren!: boolean;
}
export class CommandLeaseDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/) leaseToken!: string;
}
export class CommandResultDto extends CommandLeaseDto {
  @IsIn([
    'stopped',
    'already_stopped',
    'target_changed',
    'still_running',
    'replacement_listener',
    'inspection_failed',
    'stopped_unverified_listeners',
    'tree_changed',
    'tree_limit',
    'permission_denied',
    'partial',
    'unknown',
    'STALE_OBSERVATION',
    'MODULE_DISABLED',
    'LOCAL_CONTROL_DISABLED',
    'PLATFORM_UNAVAILABLE',
    'ACTION_CONFLICT',
    'HISTORY_WRITE_FAILED',
    'expired',
  ])
  outcome!: string;
}
