import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
export class ApplicationQuery {
  @IsUUID() deviceId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @IsOptional() @IsIn(['day', 'week', 'month']) period:
    'day' | 'week' | 'month' = 'day';
  @IsOptional()
  @Matches(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/)
  @MaxLength(255)
  applicationId?: string;
  @IsOptional() @IsString() @MaxLength(50) categoryId?: string;
}
export class ApplicationCategoryDto {
  @IsUUID() deviceId!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @Matches(/^[^\p{Cc}]+$/u)
  @Matches(/\S/)
  name!: string;
}
export class ApplicationCorrectionDto {
  @IsUUID() deviceId!: string;
  @Matches(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/)
  @MaxLength(255)
  applicationId!: string;
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  categoryId!: string | null;
}
