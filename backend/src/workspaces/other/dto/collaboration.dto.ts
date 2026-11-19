import { IsIn, IsUUID } from 'class-validator';
import { EmailDto, ActionTokenDto } from '../../../auth/other/dto/account.dto';
import { WorkspaceRole } from '../../entity/membership.entity';
export class InvitationDto extends EmailDto {
  @IsIn([
    WorkspaceRole.NETWORK_ADMIN,
    WorkspaceRole.ANALYST,
    WorkspaceRole.EMPLOYEE,
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
    WorkspaceRole.NETWORK_ADMIN,
    WorkspaceRole.ANALYST,
    WorkspaceRole.EMPLOYEE,
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
