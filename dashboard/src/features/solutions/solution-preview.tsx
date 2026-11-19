"use client";

import Image from "next/image";
import { Code2 } from "lucide-react";
import { useId, useRef } from "react";
import { productScreens } from "@/features/marketing/product-screens";
import {
  button,
  caption,
  ProductImage,
  WindowFrame,
} from "@/features/marketing/ui";

export function SolutionPreview() {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const screen = productScreens.services;
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-[#715c80]">
          <Code2
            size={20}
            strokeWidth={1.5}
            aria-hidden="true"
            className="text-[#9a7bac]"
          />
          Your development workspace
        </span>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-lg border border-[#dfd3e7] bg-white px-3 py-2 text-[10px] font-semibold text-[#705380] hover:bg-[#f2edf6]"
          onClick={() => dialog.current?.showModal()}
        >
          Enlarge preview
        </button>
      </div>
      <WindowFrame title="NetSentry Desktop · Service inventory">
        <div className="aspect-[1.75] overflow-hidden">
          <ProductImage {...screen} full />
        </div>
      </WindowFrame>
      <p className={caption}>
        Desktop renderer preview · Empty inventory. Native release checks remain
        pending.
      </p>
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
            Desktop service inventory
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
          width={1440}
          height={940}
          sizes="94vw"
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
