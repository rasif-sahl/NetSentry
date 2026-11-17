# Contact page validation

## Source scope

The approved `/contact` page uses the existing Next.js/Tailwind CSS 4 pipeline, shared marketing navigation, brand, buttons and copyright components. It includes the enquiry form preview, topic choices, contact guidance, documentation links and native FAQ disclosures. Public navigation, the homepage Learn footer and documentation link to the page.

The form is explicitly a non-sending preview. Valid attempts say delivery is unavailable and the message has not been sent; values remain available for editing. Required fields, name whitespace, email syntax and field lengths use native validation. An initially present live status announces the unavailable-delivery result and clears on edits. The form has no submission names or delivery action, and its fieldset stays disabled until hydration. A no-JavaScript explanation is rendered with working documentation links. No contact recipient/provider, endpoint, storage, email, message transmission or success claim is introduced.

## Recorded result — 17 November 2026

- Production build and TypeScript checks passed; `/contact` is statically rendered.
- All twenty-two public browser tests passed, including three new Contact checks.
- Desktop (1440px) and narrow (390px) screenshots were reviewed against the approved design.
- Changed web sources passed Prettier checks; `git diff --check` passed.

## Reproduce

```sh
npm --prefix dashboard run build
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm --prefix dashboard run test:public
```

Contact coverage includes public-route navigation, metadata/current-page state, section scrolling, live documentation/workspace-guide links, no API requests/browser errors, required-field focus, whitespace/email validity, all topic options, reply agreement, unavailable-delivery status, retained values/edit reset, keyboard Enter handling, no form transmission or email in URLs, FAQ keyboard toggling, unique local anchors, mobile menu/Escape/route closing and a separate JavaScript-disabled context with disabled inputs and usable documentation. Contact, Documentation and Product are checked for document overflow at 320, 360, 390, 650, 768, 900, 901, 1024, 1101, 1280 and 1440 pixels. Existing public-page tests remain included.

Narrow desktop browser windows do not certify physical phones. Live contact delivery and provider acceptance remain unimplemented; backend/workspace/native behavior is unchanged. No native builds, signing, hardware or physical-device acceptance are implied. No dependencies, SDKs, databases or hosting resources were provisioned.
