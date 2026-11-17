# Draft Terms and Conditions validation

## Source scope

The approved `/terms` page is implemented in the existing Next.js/Tailwind CSS 4 project with twelve typed draft sections, a visible draft notice and an unconfirmed effective date. Desktop contents become a native disclosure below 651px. The shared `PolicyContents` component accepts separate Terms/Privacy prefixes and labels while preserving the Privacy defaults. Header/closing/return-to-top actions use unique `terms-*` anchors. All existing public footers link to Terms, including Privacy Policy.

The page introduces no effective agreement, acceptance event, checkbox or registration gate. Operator identity, eligibility, commercial arrangements, warranty/liability, dispute procedures and governing law remain unconfirmed. It preserves the approved platform, permission, consent, sandbox-pricing and non-sending Contact boundaries. No account, monitoring, billing, contact or privacy-request API is called.

## Recorded result — 17 November 2026

- Production build and TypeScript checks passed; `/terms` is statically rendered.
- All twenty-eight public browser tests passed, including three Terms checks and the existing Privacy Policy checks.
- Desktop (1440px) and narrow (390px) screenshots were reviewed against the approved design.
- Changed web sources passed Prettier checks; `git diff --check` passed.

## Reproduce

```sh
npm --prefix dashboard run build
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm --prefix dashboard run test:public
```

Terms checks cover eight incoming footer routes, metadata and visible draft status, twelve sections, no acceptance/paid-purchase claims, no API calls/browser errors, Privacy Policy navigation, every contents link and selected state, actual scrolling, reload/direct-link selection, browser back navigation, cached-route anchors, header and closing actions, return to top, keyboard mobile disclosure, mobile website navigation, and no document overflow at 320, 360, 390, 650, 651, 768, 1024, 1280 and 1440 pixels. A separate JavaScript-disabled mobile context verifies native disclosure, anchors and the Privacy Policy link. Existing public-page and Privacy Policy checks remain included.

Browser widths do not certify physical phones. Final legal/business wording and an effective date remain pending. No backend, workspace, native, billing or data-processing behavior is changed. No SDKs, dependencies, databases, providers or hosting resources were provisioned; native builds/signing, hardware and physical-device acceptance are outside this increment.
