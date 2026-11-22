import { MarketingNavigation } from "@/features/marketing/navigation";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flow-root min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif]">
      <MarketingNavigation />
      {children}
    </div>
  );
}
