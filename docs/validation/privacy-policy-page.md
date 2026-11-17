# Draft Privacy Policy validation

## Source scope

The approved `/privacy` design is implemented with the existing Next.js/Tailwind CSS 4 pipeline, shared marketing navigation/buttons/brand and cached copyright. It contains ten typed draft sections, a draft notice, an unconfirmed effective date, desktop contents, a native mobile contents disclosure, a return-to-top action and links to the existing privacy-controls guide. All public marketing and documentation footers link to the policy.

Policy copy remains a draft: entity, provider, retention, hosting/transfer, legal-ground, regional, child-account, security and privacy-contact details still require finalization. No effective legal policy, certification or processing promise is introduced. Contact delivery remains accurately described as unavailable. No account, monitoring, contact or privacy-request API is called; existing product behavior is unchanged.

## Recorded result — 17 November 2026

- Production build and TypeScript checks passed; `/privacy` is statically rendered.
- All twenty-five public browser tests passed, including three Privacy Policy checks.
- Desktop (1440px) and narrow (390px) screenshots were reviewed against the approved design.
- Changed web sources passed Prettier checks; `git diff --check` passed.

## Reproduce

```sh
npm --prefix dashboard run build
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm --prefix dashboard run test:public
```

Privacy coverage includes links from seven public footers; metadata and visible draft status; ten sections; no API calls/browser errors; privacy-guide navigation; every contents link and selected state; unique targets; actual scrolling; reload/direct-hash selection; browser back navigation; return to top; client-navigation/cached-route anchors; mobile disclosure keyboard operation; mobile navigation; no document overflow at 320, 360, 390, 650, 651, 768, 1024, 1280 and 1440 pixels; and a separate JavaScript-disabled mobile context with native anchors, disclosure and guide links. Existing public-page checks remain included.

Browser widths do not certify physical phones. Final policy review and operational details remain pending. Native builds, signing, hardware, physical-device validation and production deployment are outside this increment. No dependencies, SDKs, databases, providers or hosting resources were provisioned.
