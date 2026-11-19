import { Suspense } from "react";
import { DocumentationFooter } from "./chrome";
import { DocumentationHome, DocumentationHomeQuery } from "./home";

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
