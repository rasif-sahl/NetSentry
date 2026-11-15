import { IsIn, IsUUID } from 'class-validator';
import { EmailDto, ActionTokenDto } from '../../auth/dto/account.dto';
import { WorkspaceRole } from '../membership.entity';
export class InvitationDto extends EmailDto {
  @IsIn([
    WorkspaceRole.ADMIN,
    WorkspaceRole.GUARDIAN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  ])
  role!: WorkspaceRole;
}
export class AcceptInvitationDto extends ActionTokenDto {}
export class ChangeRoleDto {
  @IsIn([
    WorkspaceRole.ADMIN,
    WorkspaceRole.GUARDIAN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  ])
  role!: WorkspaceRole;
}
export class TransferOwnershipDto {
  @IsUUID() userId!: string;
}
