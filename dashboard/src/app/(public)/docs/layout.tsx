import { DocumentationSidebar } from "@/features/documentation/sidebar";

export default function DocumentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif] text-[#2c2437] selection:bg-[#e7dcef]">
      <div className="mx-auto mt-6 grid w-[calc(100%-40px)] max-w-[1264px] grid-cols-1 gap-6 sm:w-[calc(100%-56px)] min-[961px]:mt-10 min-[961px]:grid-cols-[215px_minmax(0,1fr)] min-[961px]:gap-8 xl:w-[calc(100%-80px)] xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-[55px]">
        <DocumentationSidebar />
        <main id="documentation-main" tabIndex={-1} className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
