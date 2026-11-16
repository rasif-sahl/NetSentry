import {
  IsIn,
  IsUUID,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
export class OperatorPasswordDto {
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
export class AccountStatusDto extends OperatorPasswordDto {
  @IsIn(['ACTIVE', 'SUSPENDED']) status!: string;
}
export class FlagDto extends OperatorPasswordDto {
  @IsIn(['global', 'workspace']) scope!: string;
  @IsUUID() workspaceId!: string;
  @IsIn(['network', 'developer', 'advanced_apps', 'family', 'business'])
  key!: string;
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(0) expectedRevision!: number;
}
export class CompatibilityDto extends OperatorPasswordDto {
  @Matches(/^[a-z0-9][a-z0-9_.-]{1,79}$/) key!: string;
  @IsIn(['router', 'device', 'agent', 'category']) kind!: string;
  @IsString() @MinLength(1) @MaxLength(100) label!: string;
  @IsIn(['unverified', 'candidate', 'verified', 'unsupported']) status!: string;
  @IsString() @MinLength(1) @MaxLength(500) evidence!: string;
  @IsInt() @Min(0) expectedRevision!: number;
}
