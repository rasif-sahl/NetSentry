"use client";

import { useEffect, useRef, type ReactNode } from "react";
import motion from "./public-motion.module.css";

const targets = [
  `.${motion.intro}`,
  `.${motion.preview}`,
  `.${motion.reveal}`,
  `.${motion.previewReveal}`,
  `.${motion.reading}`,
  `.${motion.stagger} > *`,
].join(", ");

export function PublicScrollMotion({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = container.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      return;
    }

    const watched = new Set<Element>();
    // Enter inside the viewport and reset only after a full exit. The gap
    // keeps the animation's own translation from immediately triggering a reset.
    const enter = new IntersectionObserver(
      (entries) => {
        for (const { isIntersecting, target } of entries) {
          if (!isIntersecting || !watched.has(target)) continue;
          target.setAttribute("data-motion-entered", "");
          enter.unobserve(target);
          leave.observe(target);
        }
      },
      { rootMargin: "-40px 0px" },
    );
    const leave = new IntersectionObserver((entries) => {
      for (const { isIntersecting, target } of entries) {
        if (isIntersecting || !watched.has(target)) continue;
        target.removeAttribute("data-motion-entered");
        leave.unobserve(target);
        enter.observe(target);
      }
    });

    function observeSections() {
      if (!root) return;
      for (const element of watched) {
        if (root.contains(element)) continue;
        enter.unobserve(element);
        leave.unobserve(element);
        element.removeAttribute("data-motion-entered");
        watched.delete(element);
      }
      for (const element of root.querySelectorAll(targets)) {
        if (watched.has(element)) continue;
        watched.add(element);
        enter.observe(element);
      }
    }

    const changes = new MutationObserver(observeSections);
    root.setAttribute("data-public-motion", "");
    observeSections();
    changes.observe(root, { childList: true, subtree: true });

    return () => {
      enter.disconnect();
      leave.disconnect();
      changes.disconnect();
      root.removeAttribute("data-public-motion");
      for (const element of root.querySelectorAll("[data-motion-entered]")) {
        element.removeAttribute("data-motion-entered");
      }
    };
  }, []);

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}
