# Workspace permission foundation

Every protected action first requires current membership in the requested workspace. Being an owner in one workspace grants no access to another. Role names come from database membership records, never a device report or a request body. Unknown roles deny access.

| Existing role | Read workspace/devices | Register a device | View developer services | Pass workspace service-control gate |
| --- | --- | --- | --- | --- |
| OWNER | Yes | Yes | Yes | Yes |
| ADMIN | Yes | Yes | Yes | Yes |
| GUARDIAN | Yes | Yes | Yes | No |
| MEMBER | Yes | Yes | Yes | No |
| VIEWER | Yes | No | Yes | No |

Device read and registration endpoints now use `WorkspaceAccessService`. A VIEWER can inspect inventory but cannot register/update a device. Installation ownership checks still prevent takeover by another user or workspace, including by an administrator. Membership removal takes effect on subsequent requests because permission checks read current membership.

Developer permissions reserve separate viewing/control gates; no service-control API is implemented yet. Passing the workspace control gate will additionally require explicit device pairing/control authorization, an enabled module, supported action, unrevoked credentials and current consent. Capability reports describe technical support, not authority. Family guardian status does not grant desktop process-control permission.

This is a foundation for the existing role enum, not the complete Family/Business role model. Invitations, children, organizations, detailed profile/device grants, policies, user management and subscription permissions remain Phase 2/11/13 work. Role administration endpoints are not introduced here.

Unit and live API tests cover denied cross-workspace access, read-only viewers, invalid roles, no device queries after access denial, installation ownership, and membership revocation. No mobile build or agent runtime is needed for these checks.
