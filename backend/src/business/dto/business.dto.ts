import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class NameDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  @Matches(/^[^\p{Cc}]+$/u)
  name!: string;
}
export class DepartmentDto extends NameDto {
  @IsUUID() locationId!: string;
}
export class EmployeeDto {
  @IsUUID() userId!: string;
  @IsOptional() @IsUUID() departmentId?: string;
}
export class EmployeeDepartmentDto {
  @IsInt() @Min(1) expectedRevision!: number;
  @IsOptional() @IsUUID() departmentId?: string;
}
export class NetworkLocationDto {
  @IsUUID() locationId!: string;
}
export class AssignmentDto {
  @IsUUID() employeeId!: string;
  @IsInt() @Min(0) expectedRevision!: number;
}
export class BusinessConsentDto {
  @IsInt() @Min(1) generation!: number;
  @IsInt() @Min(1) expectedRevision!: number;
  @IsBoolean() @IsIn([true]) accepted!: boolean;
  @IsIn(['business-sharing-v1']) disclosureVersion!: string;
}
export class CustodyDto {
  @IsBoolean() @IsIn([true]) accepted!: boolean;
  @IsIn(['business-custody-v1']) disclosureVersion!: string;
}
export class ComplianceDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsInt() @Min(5) @Max(10080) staleMinutes!: number;
  @IsBoolean() requireMonitoring!: boolean;
  @IsBoolean() requirePermission!: boolean;
}
export class BusinessAlertDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsBoolean() resolved!: boolean;
}
export class BusinessReportQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
}
export class ConfirmOffboardDto {
  @IsIn(['OFFBOARD']) confirmation!: string;
}
export class ConfirmUnenrolDto {
  @IsIn(['UNENROL']) confirmation!: string;
}

export class EndpointDepartmentDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsOptional() @IsUUID() departmentId?: string;
}
export class BusinessScopeQuery {
  @IsOptional() @IsIn(['true']) omitEndpoints?: string;
  @IsOptional() @IsUUID() locationId?: string;
}
