// Frozen Phase 1 identity metadata, used only to verify adoption of old schemas.
// Do not update this snapshot when application entities change.
import { User } from './users/user.entity';
import { Session } from './auth/session.entity';
import { Workspace } from './workspaces/workspace.entity';
import { Membership } from './workspaces/membership.entity';
import { RegisteredDevice } from './workspaces/registered-device.entity';
export const baselineEntities = [
  User,
  Session,
  Workspace,
  Membership,
  RegisteredDevice,
];
