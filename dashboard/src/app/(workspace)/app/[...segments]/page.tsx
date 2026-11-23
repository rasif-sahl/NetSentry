import { notFound } from "next/navigation";
import { WorkspacePage } from "@/features/workspace/dashboard-shell";
import {
  isWorkspaceSlug,
  workspaceSections,
} from "@/features/workspace/routes";

export function generateStaticParams() {
  return Object.keys(workspaceSections)
    .filter(Boolean)
    .map((section) => ({ segments: [section] }));
}

export default async function DashboardPage({
  params,
}: PageProps<"/app/[...segments]">) {
  const { segments } = await params;
  const [section] = segments;
  if (segments.length !== 1 || !isWorkspaceSlug(section)) notFound();
  return <WorkspacePage section={workspaceSections[section]} />;
}
