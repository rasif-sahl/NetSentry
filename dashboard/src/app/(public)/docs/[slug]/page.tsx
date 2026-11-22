import motion from "@/features/marketing/public-motion.module.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import {
  findGuide,
  guides,
  type GuideBlock,
} from "@/features/documentation/guides";
import { DocumentationFooter } from "@/features/documentation/chrome";
import { button, ProductImage, WindowFrame } from "@/features/marketing/ui";

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.id }));
}
export async function generateMetadata({
  params,
}: PageProps<"/docs/[slug]">): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();
  return {
    title: `${guide.title} — NetSentry documentation`,
    description: guide.summary,
  };
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p
          className={`${motion.reading} mt-4 text-base leading-relaxed text-marketing-copy`}
        >
          {block.text}
        </p>
      );
    case "list":
      return (
        <ul
          className={`${motion.reading} my-5 list-disc space-y-2 pl-5 text-base leading-relaxed text-marketing-copy`}
        >
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "note":
      return (
        <aside
          className={`${motion.reading} mt-6 rounded-lg border border-[#e8dfee] border-l-[3px] border-l-[#a789ba] bg-marketing-hover px-5 py-4`}
        >
          <h3 className="font-[inherit] text-xs font-semibold text-[#715c80]">
            {block.title}
          </h3>
          <p className="mt-2 text-base leading-relaxed text-marketing-copy">
            {block.text}
          </p>
        </aside>
      );
    case "workspace-image":
      return (
        <figure className={`${motion.previewReveal} mt-6`}>
          <WindowFrame title="NetSentry · Web workspace">
            <div className="aspect-[1.8] overflow-hidden">
              <ProductImage
                src="/product/dashboard.png"
                alt="Upright web dashboard with active workspace selection and an empty device inventory"
                full
              />
            </div>
          </WindowFrame>
          <figcaption className="mt-3 text-center text-[9px] leading-[1.8] text-[#9a87a5]">
            Web interface preview · Empty workspace example, not live monitoring
            data.
          </figcaption>
        </figure>
      );
    case "next":
      return (
        <div
          className={`${motion.reading} mt-6 rounded-[10px] border border-marketing-nav-border bg-[#faf8fc] px-6 py-5`}
        >
          <p className="mb-2 text-[8px] font-semibold uppercase tracking-wider text-[#a08aaf]">
            Continue with
          </p>
          <Link
            href={`/docs/${block.slug}`}
            className="text-[13px] font-semibold text-[#715c80] hover:underline"
          >
            {block.label}
          </Link>
        </div>
      );
  }
}

export default async function GuidePage({ params }: PageProps<"/docs/[slug]">) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();
  const sectionId = (id: string) => `docs-${slug}-${id}`;
  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-3 text-[10px] text-[#9a87a5]"
        >
          <Link href="/docs" className="text-[#806193]">
            Documentation
          </Link>
          <span aria-hidden="true">/</span>
          <span>{guide.category}</span>
        </nav>
        <form
          role="search"
          action="/docs"
          method="get"
          className="flex w-full items-center gap-2 rounded-lg border border-marketing-nav-border bg-white px-3 sm:w-[220px]"
        >
          <Search
            size={15}
            strokeWidth={1.5}
            aria-hidden="true"
            className="shrink-0 text-[#a08aaf]"
          />
          <input
            type="search"
            name="q"
            aria-label="Search documentation"
            placeholder="Search documentation"
            className="h-10 min-w-0 w-full bg-transparent text-base text-marketing-copy placeholder:text-[#a18dad]"
          />
        </form>
      </div>
      <div className="grid gap-7 min-[1201px]:grid-cols-[minmax(0,1fr)_150px] min-[1201px]:gap-9">
        <article
          id={`docs-article-${slug}`}
          className="min-w-0 min-[1201px]:max-w-[670px]"
        >
          <p className="mb-4 text-[9px] font-semibold uppercase tracking-[1.7px] text-[#947da1]">
            {guide.category}
          </p>
          <h1
            className={`${motion.intro} font-[inherit] text-[35px] font-semibold leading-[1.2] tracking-[-.035em] sm:text-[42px]`}
          >
            {guide.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-marketing-copy">
            {guide.summary}
          </p>
          <div className="mt-8">
            {guide.sections.map((section) => (
              <section
                key={section.id}
                id={sectionId(section.id)}
                className="mt-8 scroll-mt-28 first:mt-0"
              >
                <h2
                  className={`${motion.reading} font-[inherit] text-2xl font-semibold leading-tight tracking-[-.035em] sm:text-[25px]`}
                >
                  {section.title}
                </h2>
                {section.blocks.map((block, index) => (
                  <Block key={index} block={block} />
                ))}
              </section>
            ))}
          </div>
          <div
            className={`${motion.reading} mt-9 border-t border-marketing-nav-border pt-6`}
          >
            <p className="mb-5 text-[11px] text-[#9a87a5]">
              You have reached the end of this guide.
            </p>
            <Link href="/docs" className={button}>
              Browse all documentation
            </Link>
          </div>
        </article>
        <aside
          aria-label="On this page"
          className="row-start-1 self-start rounded-[10px] border border-marketing-nav-border px-5 py-4 min-[1201px]:sticky min-[1201px]:top-[119px] min-[1201px]:col-start-2 min-[1201px]:rounded-none min-[1201px]:border-0 min-[1201px]:border-l min-[1201px]:p-0 min-[1201px]:pl-5"
        >
          <p className="text-[8px] font-semibold uppercase tracking-wider text-[#947da1]">
            On this page
          </p>
          <nav
            aria-label="Article contents"
            className="mt-4 flex flex-wrap gap-x-5 gap-y-3 min-[1201px]:flex-col"
          >
            {guide.sections.map((section) => (
              <a
                key={section.id}
                href={`#${sectionId(section.id)}`}
                className="text-[10px] leading-[1.8] text-marketing-caption hover:text-[#604675]"
              >
                {section.title}
              </a>
            ))}
          </nav>
          <Link
            href="/docs/availability"
            className="mt-6 hidden border-t border-marketing-nav-border pt-4 text-[9px] text-[#a08aaf] min-[1201px]:block"
          >
            Platform availability
          </Link>
        </aside>
      </div>
      <DocumentationFooter />
    </>
  );
}
