import type { Metadata } from "next";
import "../dashboard.css";

export const metadata: Metadata = {
  title: "NetSentry — Workspace",
  description: "Your devices, reported usage, alerts and workspace settings.",
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="workspace-app min-h-screen">{children}</div>;
}
