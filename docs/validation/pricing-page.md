# Pricing page validation

## Source scope

The approved `/pricing` page is implemented using the existing Next.js and Tailwind CSS 4 pipeline, shared marketing navigation, brand, button and copyright components. It includes four aligned edition cards, an edition comparison, shared principles, native FAQ disclosures and local section actions. Public navigation, the homepage Learn footer and documentation link to the page.

The content describes proposed editions. Prices, commercial limits and launch availability remain unconfirmed; paid plans show “Coming soon”. Sandbox TST amounts and technical capacity/retention/trial values are not published as sale terms. No checkout, live billing, monitoring request, external service, new dependency or native/workspace/API behavior is introduced. Permissions, consent and supported capabilities remain independent of editions.

## Recorded result — 17 November 2026

- Production build and TypeScript checks passed; `/pricing` is statically rendered.
- All nineteen public browser tests passed, including two new Pricing checks.
- Desktop (1440px) and narrow (390px) screenshots were reviewed against the approved design.
- Changed web sources passed Prettier checks; `git diff --check` passed.

## Reproduce

```sh
npm --prefix dashboard run build
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm --prefix dashboard run test:public
```

Pricing checks cover links from each public marketing route and Documentation, metadata, selected navigation, four editions, pre-launch wording, section links and actual scrolling, no API requests or browser errors, FAQ pointer/keyboard behavior, table semantics and keyboard scrolling, mobile menu/Escape/route closing, valid unique anchor targets, arrow-free controls and page overflow checks at 360, 390, 600, 768, 800, 961, 1024, 1280 and 1440 pixels. Documentation is also checked for overflow at those widths after its header gained Pricing. The comparison scroll container is positioned so offscreen accessible labels remain contained after horizontal scrolling and viewport changes.

Browser widths and screenshots do not certify physical devices. Backend billing, native builds/signing, hardware, app-store purchases and production deployment are outside this increment; their existing acceptance gates remain unchanged. No dependencies, SDKs, databases or hosting resources were provisioned.
