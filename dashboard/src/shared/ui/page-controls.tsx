import type { usePage } from "@/shared/use-page";

export function PageControls({
  label,
  page,
}: {
  label: string;
  page: Pick<
    ReturnType<typeof usePage>,
    "pageNumber" | "hasNext" | "previous" | "next" | "loading"
  >;
}) {
  if (page.pageNumber === 1 && !page.hasNext) return null;
  return (
    <nav
      aria-label={`${label} pages`}
      className="mt-4 flex flex-wrap items-center justify-end gap-2"
    >
      <button
        type="button"
        className="button"
        disabled={page.pageNumber === 1}
        onClick={page.previous}
      >
        Previous
      </button>
      <span role="status" className="px-1 text-sm text-text-secondary">
        Page {page.pageNumber}
      </span>
      <button
        type="button"
        className="button"
        disabled={!page.hasNext || page.loading}
        onClick={page.next}
      >
        Next
      </button>
    </nav>
  );
}
