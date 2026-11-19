import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class NetworkSiteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  @Matches(/^[^\p{Cc}]+$/u)
  name!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsString({ each: true })
  cidrs!: string[];
}
export class NetworkGrantDto {
  @IsUUID() agentId!: string;
  @IsBoolean() enabled!: boolean;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
  @IsIn(['network-sharing-v1']) disclosureVersion!: string;
}
export class NetworkLocalDto {
  @IsUUID() networkId!: string;
  @IsInt() @Min(1) generation!: number;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
  @IsIn(['network-sharing-v1']) disclosureVersion!: string;
}
class InterfaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_.:-]+$/)
  name!: string;
  @IsString() @MaxLength(32) cidr!: string;
  @ValidateIf((_, v) => v !== null) @IsString() gateway!: string | null;
}
class NeighborDto {
  @IsString() address!: string;
  @ValidateIf((_, v) => v !== null)
  @Matches(/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/)
  mac!: string | null;
  @IsIn(['reachable', 'cached', 'unknown']) evidence!: string;
}
class RouterResultDto {
  @IsUUID() routerId!: string;
  @IsInt() @Min(1) revision!: number;
  @IsIn(['ok', 'auth_failed', 'tls_failed', 'unavailable', 'unsupported'])
  status!: string;
  @ValidateIf((_, v) => v !== null) @IsBoolean() wanUp!: boolean | null;
  @ValidateIf((_, v) => v !== null)
  @Matches(/^(0|[1-9]\d{0,11})$/)
  uptimeSeconds!: string | null;
  @ValidateIf((_, v) => v !== null) @IsString() rxBytes!: string | null;
  @ValidateIf((_, v) => v !== null) @IsString() txBytes!: string | null;
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]*$/u)
  model!: string | null;
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]*$/u)
  firmware!: string | null;
  @ValidateIf((_, v) => v !== null) @IsUUID() testRequestId!: string | null;
}
export class NetworkSnapshotDto {
  @IsIn([1]) schemaVersion!: number;
  @IsUUID() snapshotId!: string;
  @IsUUID() networkId!: string;
  @IsInt() @Min(1) generation!: number;
  @IsInt() @Min(1) revision!: number;
  @IsISO8601({ strict: true }) @Matches(/\.\d{3}Z$/) observedAt!: string;
  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => InterfaceDto)
  interfaces!: InterfaceDto[];
  @IsArray()
  @ArrayMaxSize(128)
  @ValidateNested({ each: true })
  @Type(() => NeighborDto)
  neighbors!: NeighborDto[];
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => RouterResultDto)
  router!: RouterResultDto | null;
}
export class RouterSetupDto {
  @IsUUID() agentId!: string;
  @IsIn(['openwrt-ubus-v1']) adapter!: string;
  @IsString() @MaxLength(256) url!: string;
  @IsString() @Matches(/^[a-zA-Z0-9_]{1,32}$/) interfaceName!: string;
  @IsString() @MaxLength(8192) caCertificate!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]+$/u)
  username!: string;
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
  @IsString() @MaxLength(100) @Matches(/^[^\p{Cc}]*$/u) manufacturer!: string;
  @IsString() @MaxLength(100) @Matches(/^[^\p{Cc}]*$/u) model!: string;
  @IsString() @MaxLength(100) @Matches(/^[^\p{Cc}]*$/u) firmware!: string;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
  @IsIn(['network-sharing-v1']) disclosureVersion!: string;
}
export class EndpointUpdateDto {
  @IsString() @MaxLength(100) @Matches(/^[^\p{Cc}]*$/u) name!: string;
  @IsIn([
    'unknown',
    'phone',
    'tablet',
    'computer',
    'television',
    'console',
    'smart_home',
    'printer',
    'camera',
    'network',
  ])
  category!: string;
  @IsIn(['unknown', 'trusted', 'blocked_label']) trust!: string;
  @IsString() @MaxLength(1000) notes!: string;
  @IsBoolean() archived!: boolean;
  @ValidateIf((_, v) => v !== null) @IsUUID() assignedUserId!: string | null;
  @ValidateIf((_, v) => v !== null) @IsUUID() registeredDeviceId!:
    string | null;
}
export class NetworkEventDto {
  @IsBoolean() acknowledged!: boolean;
  @IsIn(['info', 'warning', 'critical']) severity!: string;
}
export class CompatibilityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]+$/u)
  manufacturer!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]+$/u)
  model!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\p{Cc}]+$/u)
  firmware!: string;
  @IsIn(['openwrt-ubus-v1']) adapter!: string;
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(['wan_interface_health', 'wan_counters', 'optional_board_metadata'], {
    each: true,
  })
  features!: string[];
  @IsString() @MaxLength(1000) limitations!: string;
  @IsString() @MaxLength(1000) feedback!: string;
  @IsIn(['fixture_only', 'operator_reported']) evidence!: string;
  @IsISO8601({ strict: true }) @Matches(/\.\d{3}Z$/) testedAt!: string;
}
