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
  const [section, requestedTab, networkId] = segments;
  if (
    segments.length === 3 &&
    section === "networks" &&
    requestedTab === "monitoring" &&
    /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(networkId)
  ) {
    return (
      <WorkspacePage slug="networks" tab="monitoring" networkId={networkId} />
    );
  }
  if (segments.length > 2 || !section || !isWorkspaceSlug(section)) notFound();
  const tabs = workspaceTabs(section);
  if (requestedTab && !tabs.some(({ id }) => id === requestedTab)) notFound();
  if (requestedTab && requestedTab === tabs[0]?.id)
    redirect(workspaceHref(section));
  return <WorkspacePage slug={section} tab={requestedTab ?? tabs[0]?.id} />;
}
