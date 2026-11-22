"use client";

import { useEffect, useRef, type ReactNode } from "react";
import motion from "./public-motion.module.css";

const targets = [
  `.${motion.reveal}`,
  `.${motion.previewReveal}`,
  `.${motion.reading}`,
  `.${motion.stagger} > *`,
].join(", ");

export function PublicMotionFallback({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = container.current;
    if (
      !root ||
      typeof IntersectionObserver === "undefined" ||
      (CSS.supports("animation-timeline", "view()") &&
        CSS.supports("animation-range", "entry 0% entry 65%"))
    ) {
      return;
    }

    const pending = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-motion-entered", "");
        observer.unobserve(entry.target);
        pending.delete(entry.target);
      }
    });

    function observeSections() {
      if (!root) return;
      for (const element of pending) {
        if (root.contains(element)) continue;
        observer.unobserve(element);
        pending.delete(element);
      }
      for (const element of root.querySelectorAll(targets)) {
        if (pending.has(element) || element.hasAttribute("data-motion-entered"))
          continue;
        pending.add(element);
        observer.observe(element);
      }
    }

    const changes = new MutationObserver(observeSections);
    root.setAttribute("data-motion-fallback", "");
    observeSections();
    changes.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      changes.disconnect();
      root.removeAttribute("data-motion-fallback");
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
