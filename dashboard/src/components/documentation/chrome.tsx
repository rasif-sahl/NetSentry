import Link from "next/link";
import { Brand, button } from "@/components/marketing/ui";
import { CopyrightYear } from "@/components/marketing/copyright-year";

export function DocumentationHeader() {
  return (
    <header className="sticky top-3 z-30 mx-auto mt-4 flex h-[68px] w-[calc(100%-24px)] max-w-[1312px] items-center justify-between gap-5 rounded-xl border border-[#e8e0ed] bg-white/95 px-4 backdrop-blur-xl sm:w-[calc(100%-48px)] sm:px-6 md:top-4">
      <Link href="/" aria-label="NetSentry home">
        <Brand />
      </Link>
      <nav
        aria-label="Website navigation"
        className="flex gap-5 text-xs text-[#75657f] xl:gap-7"
      >
        {[
          ["Product", "/product"],
          ["Applications", "/applications"],
          ["Solutions", "/solutions"],
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="hidden hover:text-[#604675] min-[601px]:block"
          >
            {label}
          </Link>
        ))}
        <Link
          href="/docs"
          aria-current="page"
          className="text-[10px] font-semibold text-[#604675] sm:text-xs"
        >
          Documentation
        </Link>
      </nav>
      <div className="hidden min-[961px]:block">
        <Link href="/product" className={button}>
          Explore the product
        </Link>
      </div>
    </header>
  );
}

export function DocumentationFooter() {
  return (
    <footer className="mt-10 flex flex-col justify-between gap-4 border-t border-[#e8e0ed] pb-7 pt-6 text-[9px] text-[#9a87a5] sm:flex-row">
      <p>
        © <CopyrightYear /> NetSentry
      </p>
      <div className="flex gap-5">
        <Link href="/applications">Applications</Link>
        <Link href="/docs/privacy">Privacy controls</Link>
      </div>
    </footer>
  );
}
