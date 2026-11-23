import { notFound, redirect } from "next/navigation";
import { WorkspacePage } from "@/features/workspace/dashboard-shell";
import {
  isWorkspaceSlug,
  workspaceHref,
  workspaceSections,
  workspaceTabs,
} from "@/features/workspace/routes";

export function generateStaticParams() {
  return Object.keys(workspaceSections).flatMap((section) =>
    section && isWorkspaceSlug(section)
      ? [
          { segments: [section] },
          ...workspaceTabs(section)
            .slice(1)
            .map(({ id }) => ({ segments: [section, id] })),
        ]
      : [],
  );
}

export default async function DashboardPage({
  params,
}: PageProps<"/app/[...segments]">) {
  const { segments } = await params;
  const [section, requestedTab] = segments;
  if (segments.length > 2 || !section || !isWorkspaceSlug(section)) notFound();
  const tabs = workspaceTabs(section);
  if (requestedTab && !tabs.some(({ id }) => id === requestedTab)) notFound();
  if (requestedTab && requestedTab === tabs[0]?.id)
    redirect(workspaceHref(section));
  return <WorkspacePage slug={section} tab={requestedTab ?? tabs[0]?.id} />;
}
