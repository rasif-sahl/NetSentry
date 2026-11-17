# Applications page validation

## Source scope

The approved Applications design is implemented at `/applications` using the existing Next.js/Tailwind CSS 4 pipeline and local screenshot assets. Homepage/Product Overview navigation and app links reach the guide. Workspace, authentication, account-email and API routes are unchanged.

The page includes app choices, web/Android/iOS/desktop previews, a desktop screen switcher, enlarged-image dialogs, a semantic comparison table, setup steps, consent guidance and availability disclosures. Section IDs are page-specific. Captions distinguish empty/synthetic examples and reconstructed native designs from live monitoring or validated releases.

## Recorded result — 17 November 2026

- Production build and TypeScript checks passed; `/applications` is statically rendered.
- All ten public-page browser tests passed, including the three new Applications checks.
- Desktop (1440px) and narrow (390px) screenshots were reviewed against the approved design.
- Changed web sources passed Prettier checks; `git diff --check` passed.

## Checks

```sh
npm --prefix dashboard run build
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm --prefix dashboard run test:public
```

The public suite includes existing homepage/Product Overview checks and Applications checks for cross-page links, metadata, local section scrolling, no account API requests, preview enlargement/Escape/focus restoration, desktop selection, mobile menu, availability disclosure, comparison scrolling/headers, decoded images, upright screens, arrow-free controls, valid anchors and no document overflow at 360, 390, 768, 1024 and 1440 pixels.

Desktop and narrow-browser screenshots are compared with the approved design. Desktop browser widths do not certify physical phones. Native build/signing, release and physical-device validation remain pending as documented for those platforms. This change provisions no native SDKs, new dependencies, database or hosting resources.
