import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class EmailDto {
  @IsEmail() @MaxLength(254) email!: string;
}
export class ActionTokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
}
export class ResetPasswordDto extends ActionTokenDto {
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class ConfirmPasswordDto {
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
export class UpdateProfileDto {
  @IsString() @MinLength(2) @MaxLength(100) @Matches(/\S/) displayName!: string;
}
export class NotificationPreferencesDto {
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() inApp?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() push?: boolean;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() email?: boolean;
}
export class PreferencesDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['SYSTEM', 'LIGHT', 'DARK'])
  theme?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  reducedMotion?: boolean;
  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notifications?: NotificationPreferencesDto;
}
