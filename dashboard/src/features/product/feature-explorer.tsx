"use client";

import {
  ChartNoAxesColumnIncreasing,
  Code2,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

const features = [
  {
    id: "devices",
    label: "Your devices",
    icon: Smartphone,
    title: "Know what is connected to your workspace.",
    description:
      "Review enrolled devices, reported capabilities, collection choices and health. Pairing identifies a device; supported permissions and consent determine what it can report.",
    details: [
      "Device inventory",
      "Capabilities & health",
      "Collection choices",
    ],
  },
  {
    id: "reports",
    label: "Usage & reports",
    icon: ChartNoAxesColumnIncreasing,
    title: "Understand the activity behind the numbers.",
    description:
      "Explore available usage over time, compare periods and review alerts. Sources, coverage and missing data stay visible so an incomplete report does not look like a complete one.",
    details: ["Usage reports", "Coverage & sources", "Alerts & rules"],
  },
  {
    id: "sharing",
    label: "Family & teams",
    icon: UsersRound,
    title: "Give the right people the right context.",
    description:
      "Use family or business workspaces to organize supported shared reports. Membership, consent and role permissions govern what each person can see or manage.",
    details: ["Family workflows", "Business roles", "Scoped sharing"],
  },
  {
    id: "developer",
    label: "Developer tools",
    icon: Code2,
    title: "Make sense of the services on your computer.",
    description:
      "Review local services by project, runtime or listening port. Supported stop actions require exact-target review, separate confirmation and a recorded outcome.",
    details: ["Service inventory", "Project grouping", "Confirmed outcomes"],
  },
];

export function FeatureExplorer() {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % features.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + features.length) % features.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = features.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  }
  return (
    <div className="overflow-hidden rounded-[14px] border border-marketing-nav-border bg-white">
      <div
        role="tablist"
        aria-label="Explore product features"
        className="grid grid-cols-2 border-b border-marketing-nav-border bg-[#faf8fc] md:grid-cols-4"
      >
        {features.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-controls={`panel-${id}`}
            aria-selected={selected === index}
            tabIndex={selected === index ? 0 : -1}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => navigate(event, index)}
            className={`flex min-h-14 items-center justify-center gap-2 border-marketing-nav-border px-3 py-3 text-balance text-sm font-semibold leading-snug [&:nth-child(-n+2)]:border-b [&:nth-child(odd)]:border-r md:min-h-16 md:gap-3 md:border-r lg:text-base md:[&:nth-child(-n+2)]:border-b-0 md:last:border-r-0 ${selected === index ? "bg-[#eadcf3] text-[#422651] shadow-[inset_0_-3px_#725082]" : "text-marketing-label hover:bg-[#f0e8f5]"}`}
          >
            <Icon
              size={18}
              strokeWidth={1.7}
              className="shrink-0"
              aria-hidden="true"
            />
            {label}
          </button>
        ))}
      </div>
      {features.map(({ id, label, title, description, details }, index) => (
        <div
          key={id}
          id={`panel-${id}`}
          role="tabpanel"
          aria-labelledby={`tab-${id}`}
          tabIndex={0}
          hidden={selected !== index}
          className="min-h-[415px] p-6 md:min-h-[280px] md:p-10"
        >
          <div className="grid gap-5 md:grid-cols-[1.2fr_.8fr] md:gap-16">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-marketing-caption">
                0{index + 1} / {label}
              </p>
              <h3 className="max-w-[440px] font-[inherit] text-2xl font-semibold leading-[1.15] tracking-[-.025em] md:text-[25px]">
                {title}
              </h3>
              <p className="my-4 text-base leading-relaxed text-marketing-copy">
                {description}
              </p>
              <a
                className="inline-block border-b border-[#d3bedf] pb-1 text-sm font-semibold text-marketing-label"
                href={`#product-${id}`}
              >
                Explore this feature
              </a>
            </div>
            <ol className="flex flex-col justify-center">
              {details.map((detail, i) => (
                <li
                  key={detail}
                  className="border-b border-marketing-nav-border py-3 text-sm text-marketing-label last:border-b-0"
                >
                  <span className="mr-5 text-xs tracking-wide text-marketing-caption">
                    0{i + 1}
                  </span>
                  {detail}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ))}
    </div>
  );
}
