"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { button, caption, ProductImage, WindowFrame } from "./ui";

const screens = {
  dashboard: {
    src: "/product/dashboard.png",
    title: "Web dashboard",
    alt: "Web workspace showing sidebar navigation, an empty device inventory and monitoring availability",
  },
  android: {
    src: "/product/android.png",
    title: "Android app",
    alt: "Android Home with workspace, phone, device and permissions links above floating bottom tabs",
  },
  ios: {
    src: "/product/ios.png",
    title: "iOS app",
    alt: "iOS Home with grouped menu rows and rounded floating bottom navigation",
  },
  desktop: {
    src: "/product/desktop.png",
    title: "Computer status",
    alt: "Desktop app with a rounded sidebar, computer status cards and quick access links",
  },
  services: {
    src: "/product/services.png",
    title: "Service inventory",
    alt: "Desktop service inventory with project search and an empty development services list",
  },
};
type Screen = keyof typeof screens;
const enlargeButton =
  "min-h-11 rounded-lg border border-[#dfd3e7] bg-white px-3 py-2 text-[10px] font-semibold text-[#705380] hover:bg-[#f2edf6]";

export function ProductShowcase({
  kind,
}: {
  kind: "dashboard" | "mobile" | "desktop";
}) {
  const [desktop, setDesktop] = useState<"desktop" | "services">("desktop");
  const [expanded, setExpanded] = useState<Screen>("dashboard");
  const dialog = useRef<HTMLDialogElement>(null);
  function enlarge(screen: Screen) {
    setExpanded(screen);
    dialog.current?.showModal();
  }
  const selected = screens[desktop];
  return (
    <>
      {kind === "dashboard" && (
        <>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[1.8px] text-[#8c729c]">
                THE WEB WORKSPACE
              </p>
              <p className="mt-1 text-xs text-[#766a81] md:text-sm">
                One place to bring your devices together.
              </p>
            </div>
            <button
              className={`${enlargeButton} shrink-0`}
              onClick={() => enlarge("dashboard")}
            >
              Enlarge preview
            </button>
          </div>
          <WindowFrame title="NetSentry · Overview / Your workspace">
            <ProductImage {...screens.dashboard} />
          </WindowFrame>
          <p className={caption}>
            Web dashboard · Empty workspace example. Reports appear only when
            supported, authorized devices provide data.
          </p>
        </>
      )}
      {kind === "mobile" && (
        <>
          <p className="mb-8 text-center text-[9px] font-semibold tracking-[1.5px] text-[#947da1]">
            TWO PLATFORMS. ONE FAMILIAR EXPERIENCE.
          </p>
          <div className="mx-auto grid max-w-[480px] grid-cols-2 items-start gap-5 md:gap-8">
            {(["android", "ios"] as const).map((platform) => (
              <figure key={platform}>
                <div className="overflow-hidden rounded-[26px] border-[3px] border-[#5f5368] bg-[#5f5368] shadow-sm">
                  <ProductImage {...screens[platform]} phone />
                </div>
                <figcaption className="mt-5 text-center">
                  <strong className="text-sm font-semibold">
                    {platform === "android" ? "Android" : "iOS"}
                  </strong>
                  <span className="mt-1 block text-[10px] text-[#887493]">
                    {platform === "android" ? "Kotlin / Compose" : "SwiftUI"}
                  </span>
                  <button
                    className={`${enlargeButton} mt-3`}
                    aria-label={`Enlarge ${platform === "android" ? "Android" : "iOS"} preview`}
                    onClick={() => enlarge(platform)}
                  >
                    Enlarge preview
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className={`${caption} mt-8`}>
            Native UI design reconstructions · Build, signing and
            physical-device checks remain pending.
          </p>
        </>
      )}
      {kind === "desktop" && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Desktop preview screen"
              className="flex rounded-xl border border-[#dfd1e8] bg-[#f0eaf5] p-1"
            >
              {(["desktop", "services"] as const).map((screen) => (
                <button
                  key={screen}
                  aria-pressed={desktop === screen}
                  className={`min-h-11 rounded-lg px-3 py-2 text-xs md:px-4 ${desktop === screen ? "bg-white text-[#604675] shadow-sm" : "text-[#887493] hover:text-[#604675]"}`}
                  onClick={() => setDesktop(screen)}
                >
                  {screens[screen].title}
                </button>
              ))}
            </div>
            <button
              className={`${enlargeButton} ml-auto`}
              onClick={() => enlarge(desktop)}
            >
              Enlarge preview
            </button>
          </div>
          <div aria-live="polite">
            <WindowFrame title={`NetSentry Desktop · ${selected.title}`}>
              <ProductImage {...selected} />
            </WindowFrame>
          </div>
          <p className={caption}>
            Desktop renderer preview · Synthetic status used to demonstrate the
            interface.
          </p>
        </>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={`${kind}-preview-title`}
        className="fixed inset-0 m-auto max-h-[92dvh] w-[94vw] max-w-[1200px] overflow-auto rounded-2xl border border-[#d8cae2] bg-[#fdfcfe] p-4 text-[#2c2437] shadow-xl backdrop:bg-[#241b32b8] backdrop:backdrop-blur-sm md:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2
            id={`${kind}-preview-title`}
            className="font-[inherit] text-lg font-semibold md:text-2xl"
          >
            {screens[expanded].title}
          </h2>
          <button className={button} onClick={() => dialog.current?.close()}>
            Close preview
          </button>
        </div>
        <Image
          src={screens[expanded].src}
          alt={screens[expanded].alt}
          width={expanded === "android" || expanded === "ios" ? 410 : 1440}
          height={
            expanded === "android" || expanded === "ios"
              ? 810
              : expanded === "dashboard"
                ? 1050
                : 940
          }
          sizes="94vw"
          className="mx-auto block max-h-[72dvh] w-auto max-w-full rounded-lg border border-[#e2d7e8] object-contain"
        />
        <p className={caption}>
          Product design preview · Example and empty states, not live monitoring
          data.
        </p>
      </dialog>
    </>
  );
}
