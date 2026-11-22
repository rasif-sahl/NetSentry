import Link from "next/link";
import { CopyrightYear } from "@/features/marketing/copyright-year";

export function DocumentationFooter() {
  return (
    <footer className="mt-10 flex flex-col justify-between gap-4 border-t border-marketing-nav-border pb-7 pt-6 text-[9px] text-[#9a87a5] sm:flex-row">
      <p>
        © <CopyrightYear /> NetSentry
      </p>
      <div className="flex flex-wrap gap-5">
        <Link href="/applications">Applications</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/docs/privacy">Privacy controls</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms and Conditions</Link>
      </div>
    </footer>
  );
}
