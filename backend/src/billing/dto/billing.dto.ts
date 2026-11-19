import {
  IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsISO8601,
  IsOptional,
  Matches,
} from 'class-validator';
export class PlanRequestDto {
  @IsUUID() requestId!: string;
  @IsIn(['premium', 'family', 'business']) plan!: string;
  @IsIn(['monthly', 'annual']) interval!: string;
  @IsInt() @Min(0) expectedRevision!: number;
}
export class BillingRevisionDto {
  @IsInt() @Min(0) expectedRevision!: number;
}
export class SandboxConfirmDto {
  @IsUUID() requestId!: string;
}
export class BillingEventDto {
  @IsUUID() id!: string;
  @IsUUID() workspaceId!: string;
  @IsInt() @Min(1) @Max(2147483647) sequence!: number;
  @IsISO8601({ strict: true }) occurredAt!: string;
  @IsIn(['free', 'premium', 'family', 'business']) plan!: string;
  @IsIn(['monthly', 'annual']) interval!: string;
  @IsIn(['active', 'past_due', 'cancelled']) status!: string;
  @IsISO8601({ strict: true }) periodEnd!: string;
  @IsBoolean() cancelAtPeriodEnd!: boolean;
  @IsOptional() @IsUUID() paymentId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000000) amountMinor?: number;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
}
