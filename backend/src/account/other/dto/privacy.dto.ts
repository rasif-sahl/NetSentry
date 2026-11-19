import { IsIn } from 'class-validator';
import { ConfirmPasswordDto } from '../../../auth/other/dto/account.dto';

export class DeleteAccountDto extends ConfirmPasswordDto {
  @IsIn(['DELETE']) confirmation!: string;
}
