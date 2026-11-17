# Public homepage validation

## Scope

Approved simple storytelling homepage implemented in `dashboard/` with Tailwind CSS 4. Dashboard moved to `/app`; account-email URLs retained. Browser checks use existing desktop Chrome, including narrow viewports, rather than physical phones.

## Recorded result — 17 November 2026

Production build/TypeScript passed. All 28 existing dashboard integration tests passed against a disposable local PostgreSQL fixture database, which was then removed. All four public homepage tests passed after the header and primary-button fixes. Prettier checks for changed web sources and `git diff --check` passed. No SDKs, native tooling, packages or hosting resources were installed/provisioned.

## Checks

- Production Next.js build and TypeScript route validation.
- Public-page browser tests: content/platform sections; no homepage account-API calls; workspace link; preserved root bookmarks; preview screen switching; Android/iOS enlargement; dialog Escape/focus restoration; responsive navigation; FAQ; anchor targets; no horizontal overflow at 360, 390, 768 and 1440 pixels; straight screen transforms and arrow-free page copy.
- Existing dashboard browser suite updated to start at `/app`, retaining account/session, workspace, device, permissions, monitoring, sharing, theme and account-email flow coverage against isolated database fixtures.
- Desktop and narrow-page screenshots reviewed for layout parity with the approved design. The screenshots used on the page remain labelled examples, not live monitoring results.

Run the public checks without a database after building:

```sh
npm --prefix dashboard run build
PLAYWRIGHT_CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm --prefix dashboard run test:homepage
```

Run the complete integration suite using the existing database-fixture procedure in `dashboard/README.md`. Source/build/browser verification does not establish production hosting, native builds, signing, device measurement or physical-device acceptance.
