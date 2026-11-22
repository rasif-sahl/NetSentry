import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NetSentry — Applications",
  description:
    "Find your NetSentry starting point. Explore the web dashboard, Android, iOS and desktop apps, compare their roles and review setup requirements and availability.",
};

export { default } from "@/features/applications/applications-page";
