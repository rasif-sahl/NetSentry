import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export const container =
  "mx-auto w-[calc(100%-40px)] max-w-[1120px] md:w-[calc(100%-80px)]";
const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded-lg border px-5 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
export const button = `${buttonBase} border-[#e5ddeb] bg-white text-[#604675] hover:bg-[#f2edf6]`;
export const primaryButton = `${buttonBase} border-[#7e6094] bg-[#7e6094] text-white hover:bg-[#604675]`;
export const caption =
  "mt-5 text-center text-[10px] leading-relaxed text-marketing-caption";

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2 text-2xl font-bold tracking-[-1px] text-[#705283]">
      <ShieldCheck size={27} strokeWidth={1.6} aria-hidden="true" />
      NetSentry
    </span>
  );
}

export function Chapter({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-[10px] font-semibold uppercase leading-relaxed tracking-[2px] text-[#947da1]">
      {children}
    </p>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-[inherit] text-[32px] font-semibold leading-[1.15] tracking-[-0.045em] md:text-[44px]">
      {children}
    </h2>
  );
}

export function WindowFrame({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#dfd5e7] bg-white">
      <div
        className="flex h-8 items-center gap-1 border-b border-[#ece6f0] bg-[#faf8fc] px-3"
        aria-hidden="true"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-[5px] rounded-full bg-[#d6c9de]" />
        ))}
        <span className="ml-3 text-[9px] text-[#8d7b99]">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function ProductImage({
  src,
  alt,
  phone = false,
  preload = false,
  full = false,
}: {
  src: string;
  alt: string;
  phone?: boolean;
  preload?: boolean;
  full?: boolean;
}) {
  return (
    <div
      className={
        phone || full ? "overflow-hidden" : "aspect-[1.7] overflow-hidden"
      }
    >
      <Image
        src={src}
        alt={alt}
        width={phone ? 410 : 1440}
        height={phone ? 810 : src.includes("dashboard") ? 1050 : 940}
        preload={preload}
        sizes={
          phone
            ? "(max-width: 760px) 42vw, 220px"
            : "(max-width: 760px) 100vw, 1120px"
        }
        className="block h-auto w-full"
      />
    </div>
  );
}
