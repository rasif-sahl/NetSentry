# Public website and workspace routes

The approved storytelling homepage is implemented in the existing Next.js dashboard project using its locally compiled Tailwind CSS 4 pipeline. No separate hosting project, CDN stylesheet, remote font or new UI dependency is introduced.

- `/` is the public, statically rendered product homepage. It does not load account or monitoring APIs.
- `/product` is the public Product Overview page. It explains devices, reports/alerts, family/team sharing, developer tools, application roles and privacy choices without requesting account or monitoring data.
- `/applications` is the public application guide, with separate web/Android/iOS/desktop previews, role comparison, setup requirements and availability FAQs.
- `/solutions` is the public use-case guide for personal, family, team and developer workflows.
- `/docs` is the searchable documentation home; `/docs/[slug]` contains twelve customer guides with topic navigation and article contents.
- `/pricing` presents the proposed Personal Free, Personal Premium, Family and Business editions, comparison and launch-pricing FAQs.
- `/contact` provides the approved enquiry form preview, contact guidance, documentation links and FAQs. Message delivery is not configured.
- `/app` contains the existing workspace and its sign-in/register/recovery flows. The homepage's sign-in and workspace actions point here.
- `/verify-email` and `/reset-password` retain their existing URLs and fragment-token handling. Successful sign-in from these flows returns to `/app`.
- Existing `/?view=…` bookmarks redirect to `/app?view=…`, preserving query values. Workspace navigation continues to use its existing `view` query.
- The workspace route group owns the dashboard stylesheet. All its selectors are scoped to `.workspace-app`, including theme overrides, to keep workspace styles separate from the public page during client navigation.

Public page entries and guide readers are server components. Client components provide responsive navigation, product previews, the feature explorer, documentation topic navigation and local guide search. It preserves the approved straight, aligned screenshots, white/lavender palette, storytelling sections, platform distinctions, consent explanation, setup journey and availability FAQ. The mobile navigation exposes expanded state; screenshot previews use native dialogs with Escape dismissal and focus restoration. Screens do not rotate, tilt or overlap, and buttons contain no arrows.

`dashboard/public/product/` contains the approved design assets: a web empty-workspace screenshot, reconstructed Android/iOS Home designs, and desktop renderer status/service screenshots. The native images are not physical-device captures. Desktop status is synthetic and web inventory is empty; captions identify these examples. They contain no customer data and are presentation assets only. Native release/build/device acceptance remains pending as recorded in the platform validation documents. The page makes no download or app-store availability claim.

The page links only to existing sections and workspace/account functionality. Separate legal and download pages remain outside these increments; the homepage does not expose nonfunctional links or pretend those pages exist. This source implementation does not provision or deploy hosting.

## Product Overview

The `/product` page implements the approved design using Tailwind CSS 4 and the existing local screenshot assets. The homepage header/footer link to it, and its header and final action return to the homepage. Both pages share navigation, typography, button, image-frame and cached copyright-year components. The product-specific header identifies the current page and links to the Applications guide and its local privacy section.

Product section and navigation IDs are distinct from homepage IDs so Next.js cached, hidden routes cannot intercept fragment links or ARIA references during client navigation.

The feature explorer uses four accessible tabs with matching tab/panel IDs, selected state and one tab stop in the tab list. Left/Right wrap between tabs; Home/End select the first/last tab; Tab enters the active panel. The complete feature explanations remain available in the page's sections, including when JavaScript is disabled. The availability disclosure uses native `details`/`summary`.

Device identity/capability/consent diagrams are conceptual, rather than simulated device measurements. Existing empty/synthetic desktop and dashboard screenshots and reconstructed native screens retain their preview captions. No native release, authorization, measured-data or remote-action guarantee is added.

## Applications guide

The `/applications` page implements the approved upright, lavender-and-white design in Tailwind CSS 4. The homepage's “Our apps” navigation, application footer links and Product Overview's application navigation/actions lead to this route. The guide links back to `/` and `/product`; its app-choice cards scroll to unique `applications-*` section IDs, avoiding hidden-route fragment collisions.

`ApplicationPreview` uses the shared screenshot registry and image/frame primitives. Web, Android, iOS and desktop previews open native dialogs with unique React-generated title IDs, Escape dismissal and native focus restoration. The desktop switcher changes both the inline image and enlarged preview. The app-role table uses column/row headers and a labelled, focusable horizontal scroll region on narrow screens; the page itself remains within its viewport. Availability FAQs use native disclosures.

The guide makes no account/monitoring API requests, includes no download links for unvalidated native builds, and retains the platform distinctions and example/synthetic-state captions. No authentication, workspace, backend, native application, collection or process-control behavior changes.

## Solutions guide

The approved `/solutions` design is implemented with Tailwind CSS 4, shared marketing typography/buttons/navigation and existing local screenshot assets. The homepage's Solutions navigation and “Who it’s for” footer lead here, as do Solutions links in Product Overview and Applications navigation. A dedicated navigation variant highlights the current page and links to `solutions-paths`. All section IDs are page-specific to preserve fragment targets across cached routes.

The page explains personal, family, team and developer use cases, their permissions and their suggested starting applications. Family and team diagrams are labelled conceptual models rather than customer dashboards. Android/router restriction adapters are explicitly described as non-enforcing; Apple controls remain eligibility/authorization/device-validation dependent. Employee acceptance and current organization roles stay distinct from collection or process-control authority. No employee productivity scores are claimed.

The personal workspace and developer service screenshots remain upright and labelled empty examples. The developer preview uses a native dialog with a unique React-generated title ID, Escape dismissal and native focus restoration. Availability FAQs use native disclosures. Links reach real product/application routes or local sections; there are no new downloads, account requests, monitoring data or backend actions. No native or workspace behavior changes.

## Customer documentation

`/docs` implements the approved documentation home with six topic groups, twelve guides and local case-insensitive filtering of guide titles, summaries and categories. Search provides result counts, reset/clear and an empty state. Reader search submits a standard GET form to `/docs?q=…`; URL queries survive reload. A Suspense boundary isolates query access while rendering the full guide catalogue as the prerendered fallback. No search service or account/monitoring API is used.

`/docs/[slug]` uses `generateStaticParams` for the twelve known guides, per-guide metadata and `notFound()` for unknown slugs. Guide bodies are typed paragraph/list/note/image/next-guide blocks, rendered as React elements rather than injected HTML. The shared docs layout owns one stable main target, and article fragment IDs include the guide slug so cached pages do not intercept section links.

The desktop reader has a sticky topic sidebar and article contents rail; on smaller screens the topics collapse behind an expanded-state button with Escape/focus handling, and article contents appear above the guide. Active links follow the pathname, and topic navigation closes the mobile panel. The web screenshot remains upright and labelled an empty example. Guides preserve native release, permissions, sharing, platform and enforcement boundaries; customer guides are distinct from repository developer/architecture documentation.

All public marketing navigation and the homepage Learn footer now link to Documentation. Public header navigation collapses below 1280px to leave room for the added link. Workspace/account/native/API behavior, hosting and external integrations are unchanged.


## Pricing

`/pricing` implements the approved aligned plan cards, comparison table, shared principles and FAQs in Tailwind CSS 4. The page is a server component with static metadata. Shared public navigation and the homepage Learn footer link to Pricing; documentation provides header and footer links as well. The documentation header hides its secondary links below 801px to accommodate the added destination.

The public edition descriptions are separate from the backend sandbox catalog: synthetic TST amounts, sandbox capacity limits, retention bounds and trial periods are not published as commercial terms. Prices, final limits and availability remain unconfirmed; paid editions show “Coming soon”, and Free is labelled a proposed entry plan. No checkout, provider, discount, trial offer or billing mutation is added. Platform support, consent and permissions still constrain capabilities regardless of edition.

Plan actions scroll to a single comparison, and the closing actions reach plans/FAQs through unique `pricing-*` IDs. A labelled, keyboard-focusable scroll region contains the semantic comparison table on small screens; the page itself does not overflow. FAQs use native `details`/`summary`, with the purchase answer initially open. The brand and footer reach real public routes. No new dependencies, remote assets, account requests or changes to workspace/native/API behavior are introduced. See [Pricing validation](../validation/pricing-page.md).


## Contact

`/contact` implements the approved simple lavender-and-white design with a two-column enquiry form/guidance layout, responsive stacking and native FAQ disclosures. Static metadata and page content stay in a server component; `ContactForm` handles local validation and the unavailable-delivery status. The shared marketing navigation includes Contact, identifies the current page and scrolls its action to `contact-form`. The homepage Learn footer and documentation header/footer also link to Contact. Documentation secondary links begin at 901px and its product action at 1101px to accommodate the extra destination; marketing desktop link gaps are reduced to preserve the existing 1280px breakpoint.

The approved design is a non-sending form preview. No contact endpoint, recipient, email provider, storage or live message delivery is configured. The form explicitly says messages are not sent, never claims success and preserves entered values after a valid attempt. Native constraints cover required name/email/topic/message/reply agreement, email syntax and field lengths. Names must contain a non-whitespace character. The availability status is announced politely and cleared when fields change. Inputs have no submission names; a disabled fieldset keeps the form inert until its client handler is hydrated, and a no-JavaScript explanation links users to available documentation. No message data is put into URLs, browser storage or API requests.

The documentation panel opens `/docs`; FAQ links reach the workspace guide, Pricing and availability guide. All local IDs use `contact-*` to avoid cached-route collisions. No invented email address, office location, response-time promise or delivery claim is introduced. Backend, workspace and native behavior are unchanged. See [Contact validation](../validation/contact-page.md).
