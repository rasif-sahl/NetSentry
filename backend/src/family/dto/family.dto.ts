import {
  IsObject,
  IsString,
  MaxLength,
  MinLength,
  IsIn,
  IsUUID,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  ValidateIf,
  Matches,
} from 'class-validator';
export class ProfileDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(80)
  @Matches(/^[^\p{Cc}]+$/u)
  name!: string;
  @IsIn(['star', 'leaf', 'fox', 'owl', 'rocket', 'sun']) avatar!: string;
  @IsIn(['under_13', 'teen', 'adult']) ageBand!: string;
  @ValidateIf((_, v) => v !== null) @IsUUID() userId!: string | null;
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  guardians!: string[];
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  networks!: string[];
  @IsBoolean() archived!: boolean;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
  @IsIn(['family-sharing-v1']) disclosureVersion!: string;
}
export class FamilyAssignmentDto {
  @IsUUID() deviceId!: string;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
  @IsIn(['family-sharing-v1']) disclosureVersion!: string;
}
export class FamilyPolicyDto {
  @IsInt() @Min(0) expectedRevision!: number;
  // Rules are validated by the pure validator, including rejection of unknown nested keys.
  @IsObject() rules!: import('../other/family.rules').FamilyRules;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
  @IsIn(['family-sharing-v1']) disclosureVersion!: string;
}
export class FamilyRequestDto {
  @IsUUID() id!: string;
  @IsInt() @Min(1) @Max(120) minutes!: number;
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(200)
  @Matches(/^[^\p{Cc}]+$/u)
  reason!: string;
  @IsInt() @Min(1) policyRevision!: number;
}
export class FamilyDecisionDto {
  @IsIn(['approved', 'rejected', 'cancelled']) decision!: string;
}
export class FamilyFeedbackDto {
  @IsIn(['helpful', 'not_helpful', 'not_enough_data']) rating!: string;
  @IsString() @MaxLength(300) note!: string;
}
export class FamilyDeviceDto {
  @IsInt() @Min(1) generation!: number;
}
export class FamilyReceiptDto extends FamilyDeviceDto {
  @IsInt() @Min(1) policyRevision!: number;
  @IsInt() @Min(1) profileRevision!: number;
  @IsIn(['unsupported', 'failed', 'not_requested']) status!: string;
}
