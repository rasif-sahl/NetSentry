import type { Workspace } from "@/shared/types";
import { Card, Empty } from "@/shared/ui/common";

export function WorkspaceList({
  workspaces,
  activeId,
  switching,
  onSelect,
}: {
  workspaces: Workspace[];
  activeId?: string;
  switching: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <Card title="Your workspaces" className="mb-4">
      {workspaces.length === 0 ? (
        <Empty title="No workspaces yet" />
      ) : (
        <ul
          aria-label="Your workspaces"
          aria-busy={switching}
          className="divide-y divide-border"
        >
          {workspaces.map((workspace) => {
            const active = workspace.id === activeId;
            return (
              <li
                key={workspace.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1 break-words">
                  <strong className="text-sm">{workspace.name}</strong>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    <span className="capitalize">
                      {workspace.type.toLowerCase()}
                    </span>
                    {" · "}
                    <span className="capitalize">
                      {workspace.role.toLowerCase().replaceAll("_", " ")}
                    </span>
                    {" · "}
                    {workspace.timezone}
                  </p>
                </div>
                <button
                  type="button"
                  className={
                    active ? "badge min-h-11" : "button accent min-h-11"
                  }
                  aria-label={
                    active
                      ? `Active workspace: ${workspace.name}`
                      : `Switch to ${workspace.name}`
                  }
                  aria-current={active || undefined}
                  aria-disabled={active || switching}
                  onClick={() => {
                    if (!active && !switching) onSelect(workspace.id);
                  }}
                >
                  {active ? "Active" : "Switch"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
