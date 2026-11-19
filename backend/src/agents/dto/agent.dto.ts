import { Type } from 'class-transformer';
import {
  IsDefined,
  ArrayMaxSize,
  ArrayMinSize,
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
export class AgentModulesDto {
  @IsBoolean() network!: boolean;
  @IsBoolean() developer!: boolean;
}
export class AgentSettingsDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => AgentModulesDto)
  modules!: AgentModulesDto;
  @IsBoolean() backgroundAllowed!: boolean;
  @IsIn(['agent-enrolment-v1']) disclosureVersion!: string;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
}
export class AgentEnrolmentDto extends AgentSettingsDto {
  @IsUUID() installationId!: string;
  @IsIn(['darwin', 'windows', 'linux']) platform!: string;
  @IsString() @Matches(/\S/) @MaxLength(100) name!: string;
}
export class AgentRedeemDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
  @IsUUID() installationId!: string;
  @IsIn(['darwin', 'windows', 'linux']) platform!: string;
}
export class AgentHeartbeatDto {
  @IsIn([1]) schemaVersion!: number;
  @IsInt() @Min(1) generation!: number;
  @IsString()
  @Matches(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/)
  @MaxLength(100)
  version!: string;
  @IsIn(['amd64', 'arm64']) architecture!: string;
  @IsISO8601({ strict: true }) @Matches(/\.\d{3}Z$/) reportedAt!: string;
  @IsDefined()
  @ValidateNested()
  @Type(() => AgentModulesDto)
  requested!: AgentModulesDto;
  @IsBoolean() backgroundAllowed!: boolean;
  @IsInt() @Min(0) @Max(2147483647) droppedEvents!: number;
}
export class AgentDiagnosticDto {
  @IsUUID() eventId!: string;
  @IsIn(['diagnostic']) kind!: string;
  @IsIn([
    'CONNECTION_LOST',
    'CONNECTION_RESTORED',
    'BUFFER_DROPPED',
    'CONFIG_CHANGED',
    'MODULE_DISABLED',
    'INVALID_BATCH',
  ])
  code!: string;
  @IsISO8601({ strict: true }) @Matches(/\.\d{3}Z$/) occurredAt!: string;
}
export class AgentSyncDto {
  @IsIn([1]) schemaVersion!: number;
  @IsInt() @Min(1) generation!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AgentDiagnosticDto)
  events!: AgentDiagnosticDto[];
}
