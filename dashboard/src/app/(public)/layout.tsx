import { MarketingNavigation } from "@/features/marketing/navigation";
import { PublicScrollMotion } from "@/features/marketing/public-scroll-motion";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicScrollMotion className="flow-root min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif]">
      <MarketingNavigation />
      {children}
    </PublicScrollMotion>
  );
}
