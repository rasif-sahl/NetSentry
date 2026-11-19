"use client";

import Image from "next/image";
import { LayoutGrid } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  productScreens,
  type ProductScreen,
} from "@/features/marketing/product-screens";
import {
  button,
  caption,
  ProductImage,
  WindowFrame,
} from "@/features/marketing/ui";

const enlargeButton =
  "min-h-11 shrink-0 rounded-lg border border-[#dfd3e7] px-3 py-2 text-[10px] font-semibold text-[#705380] hover:bg-[#f2edf6]";

export function ApplicationPreview({
  app,
}: {
  app: "dashboard" | "android" | "ios" | "desktop";
}) {
  const [desktop, setDesktop] = useState<"services" | "desktop">("services");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const selected: ProductScreen = app === "desktop" ? desktop : app;
  const screen = productScreens[selected];
  const phone = app === "android" || app === "ios";
  const enlarge = (
    <button
      type="button"
      className={enlargeButton}
      aria-label={`Enlarge ${app === "dashboard" ? "web dashboard" : app === "desktop" ? "desktop" : app === "android" ? "Android" : "iOS"} preview`}
      onClick={() => dialog.current?.showModal()}
    >
      Enlarge preview
    </button>
  );
  return (
    <>
      {phone ? (
        <div className="flex flex-col items-center gap-5 border-y border-marketing-nav-border bg-[#faf8fc] px-6 py-7 md:gap-6 md:py-8">
          <div className="w-[185px] overflow-hidden rounded-[25px] border-[3px] border-[#5f5368] bg-[#5f5368] md:w-[205px] md:rounded-[27px]">
            <ProductImage {...screen} phone />
          </div>
          {enlarge}
        </div>
      ) : (
        <>
          <div
            className={`mb-4 flex justify-between gap-3 ${app === "desktop" ? "flex-col items-stretch sm:flex-row sm:items-center" : "items-center"}`}
          >
            {app === "dashboard" ? (
              <span className="flex items-center gap-2 text-[13px] font-semibold text-[#715c80]">
                <LayoutGrid
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="text-[#9a7bac]"
                />
                The web workspace
              </span>
            ) : (
              <div
                role="group"
                aria-label="Desktop preview screen"
                className="flex rounded-[10px] border border-[#dfd1e8] bg-[#f0eaf5] p-1"
              >
                {(["services", "desktop"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={desktop === key}
                    onClick={() => setDesktop(key)}
                    className={`min-h-10 flex-1 whitespace-nowrap rounded-[7px] px-3 py-2 text-[10px] ${desktop === key ? "bg-white text-[#604675]" : "text-marketing-caption hover:text-[#604675]"}`}
                  >
                    {productScreens[key].title}
                  </button>
                ))}
              </div>
            )}
            <div className={app === "desktop" ? "self-end sm:self-auto" : ""}>
              {enlarge}
            </div>
          </div>
          <div aria-live={app === "desktop" ? "polite" : undefined}>
            <WindowFrame
              title={
                app === "dashboard"
                  ? "NetSentry · Web workspace"
                  : `NetSentry Desktop · ${screen.title}`
              }
            >
              <div
                className={
                  app === "dashboard"
                    ? "aspect-[1.5] overflow-hidden md:aspect-[1.85]"
                    : "aspect-[1.45] overflow-hidden md:aspect-[1.5]"
                }
              >
                <ProductImage {...screen} full />
              </div>
            </WindowFrame>
          </div>
          <p className={caption}>
            {app === "dashboard"
              ? "Web dashboard preview · Empty workspace example, not live monitoring data."
              : "Desktop renderer preview · Example and empty states shown; status is synthetic."}
          </p>
        </>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[92dvh] w-[94vw] max-w-[1200px] overflow-auto rounded-2xl border border-[#d8cae2] bg-[#fdfcfe] p-4 text-[#2c2437] shadow-xl backdrop:bg-[#241b32b8] backdrop:backdrop-blur-sm md:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2
            id={titleId}
            className="font-[inherit] text-lg font-semibold md:text-2xl"
          >
            {screen.title}
          </h2>
          <button
            type="button"
            className={button}
            onClick={() => dialog.current?.close()}
          >
            Close preview
          </button>
        </div>
        <Image
          src={screen.src}
          alt={screen.alt}
          width={phone ? 410 : 1440}
          height={phone ? 810 : app === "dashboard" ? 1050 : 940}
          sizes={phone ? "(max-width: 760px) 90vw, 410px" : "94vw"}
          className="mx-auto block max-h-[72dvh] w-auto max-w-full rounded-lg border border-[#e2d7e8] object-contain"
        />
        <p className={caption}>
          Product UI preview · Example and empty states, not live monitoring
          data.
        </p>
      </dialog>
    </>
  );
}
