# Customer documentation validation

## Source scope

The approved documentation home and reader are implemented with Tailwind CSS 4 in the existing web project. `/docs` provides six topic groups and local search; twelve `/docs/[slug]` guides provide article content, sidebar selection, contents links and metadata. Known guides use generated route parameters; unknown guides use Next.js not-found handling. The public header and homepage Learn footer link to Documentation.

Guide content is stored as typed blocks and rendered as escaped React text/elements, including paragraphs, lists, notes, a labelled empty-workspace screenshot and next-guide links. Search filters titles, summaries and categories without calling account/monitoring APIs or external services. Native/platform/consent/enforcement limitations remain explicit. The workspace, account-email and API routes are unchanged.

## Recorded result — 17 November 2026

- Production build and TypeScript checks passed, including generated guide routes.
- All seventeen public-page browser tests passed, including four documentation checks covering all twelve guides.
- Desktop (1440px) and narrow (390px) home/reader screenshots were reviewed against the approved design.
- Prettier checks for changed web sources and `git diff --check` passed.

## Reproduce

```sh
npm --prefix dashboard run build
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm --prefix dashboard run test:public
```

Documentation coverage includes public navigation; no account API calls; filtering with case/whitespace normalization; empty results/reset/clear; reader-to-home query search and reload; special-character query handling; all guide titles/content/metadata; current sidebar links; article section scrolling and continuation links; unknown-guide handling; mobile topics/close/Escape/focus; image decoding and upright layout; no overflow at 360, 390, 768, 1024 and 1440 pixels. Existing public-page tests remain included.

Desktop browser widths do not certify physical phones. No native builds, signing, hardware or physical-device acceptance is performed or implied. This increment provisions no dependencies, SDKs, databases or hosting resources.
