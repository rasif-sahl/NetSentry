import type { Device, User, Workspace } from "@/shared/types";

export type PageContext = {
  user: User;
  workspace: Workspace;
  permissions: string[];
  devices: Device[];
  reloadDevices: () => void;
};
