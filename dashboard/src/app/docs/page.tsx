import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentationFooter } from "@/components/documentation/chrome";
import {
  DocumentationHome,
  DocumentationHomeQuery,
} from "@/components/documentation/home";

export const metadata: Metadata = {
  title: "NetSentry — Documentation",
  description:
    "Guides to your NetSentry workspace, device permissions, reports, sharing, developer services and platform availability.",
};

export default function DocumentationPage() {
  return (
    <>
      <Suspense fallback={<DocumentationHome />}>
        <DocumentationHomeQuery />
      </Suspense>
      <DocumentationFooter />
    </>
  );
}
