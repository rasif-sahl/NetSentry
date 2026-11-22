import { MarketingNavigation } from "@/features/marketing/navigation";

import { PublicMotionFallback } from "@/features/marketing/public-motion-fallback";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicMotionFallback className="flow-root min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif]">
      <MarketingNavigation />
      {children}
    </PublicMotionFallback>
  );
}
