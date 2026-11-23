import { DashboardShell } from "@/features/workspace/dashboard-shell";

export default function Layout({ children }: LayoutProps<"/app">) {
  return <DashboardShell>{children}</DashboardShell>;
}
