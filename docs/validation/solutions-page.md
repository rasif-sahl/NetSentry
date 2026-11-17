# Solutions page validation

## Source scope

The approved `/solutions` page uses the existing Next.js/Tailwind CSS 4 pipeline, shared marketing components and local web/desktop screenshot assets. It covers personal insight, shared family context, team reporting and developer services. Homepage/Product Overview/Applications navigation links to the guide; suggested starting points link to relevant Applications sections.

Family/team illustrations are conceptual and clearly labelled. Android/router restriction enforcement is not advertised; Apple controls remain conditional on eligibility, authorization and native validation. Team reporting follows employee sharing and role boundaries. No live customer data, productivity scores, collection authority or process-control guarantees are introduced. Workspace, authentication, API and native application source behavior are unchanged.

## Recorded result — 17 November 2026

- Production build and TypeScript checks passed; `/solutions` is statically rendered.
- All thirteen public-page browser tests passed, including three new Solutions checks.
- Desktop (1440px) and narrow (390px) screenshots were reviewed against the approved design.
- Changed web sources passed Prettier checks; `git diff --check` passed.

## Checks

```sh
npm --prefix dashboard run build
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm --prefix dashboard run test:public
```

The public suite covers existing pages plus Solutions cross-page navigation, unique section links and actual scroll targets, account-request isolation, consent/availability content, developer screenshot enlargement/Escape/focus restoration at desktop/narrow widths, mobile navigation, native disclosures, asset decoding, valid anchors, upright screenshots, arrow-free controls and no document overflow at 360, 390, 768, 1024 and 1440 pixels.

Desktop and narrow screenshots are visually compared with the approved design. Narrow desktop browser windows do not certify physical phones. Native build/signing, hardware and physical-device acceptance remain pending as documented for those platforms. No SDKs, new dependencies, database or hosting resources are provisioned by this increment.
