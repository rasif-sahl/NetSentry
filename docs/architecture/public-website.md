# Public website and workspace routes

The approved storytelling homepage is implemented in the existing Next.js dashboard project using its locally compiled Tailwind CSS 4 pipeline. No separate hosting project, CDN stylesheet, remote font or new UI dependency is introduced.

- `/` is the public, statically rendered product homepage. It does not load account or monitoring APIs.
- `/product` is the public Product Overview page. It explains devices, reports/alerts, family/team sharing, developer tools, application roles and privacy choices without requesting account or monitoring data.
- `/applications` is the public application guide, with separate web/Android/iOS/desktop previews, role comparison, setup requirements and availability FAQs.
- `/app` contains the existing workspace and its sign-in/register/recovery flows. The homepage's sign-in and workspace actions point here.
- `/verify-email` and `/reset-password` retain their existing URLs and fragment-token handling. Successful sign-in from these flows returns to `/app`.
- Existing `/?view=…` bookmarks redirect to `/app?view=…`, preserving query values. Workspace navigation continues to use its existing `view` query.
- The workspace route group owns the dashboard stylesheet. All its selectors are scoped to `.workspace-app`, including theme overrides, to keep workspace styles separate from the public page during client navigation.

The homepage, Product Overview and Applications guide are server components. Client components are limited to the shared responsive navigation, homepage product showcases, the Product Overview feature explorer and application preview controls. It preserves the approved straight, aligned screenshots, white/lavender palette, storytelling sections, platform distinctions, consent explanation, setup journey and availability FAQ. The mobile navigation exposes expanded state; screenshot previews use native dialogs with Escape dismissal and focus restoration. Screens do not rotate, tilt or overlap, and buttons contain no arrows.

`dashboard/public/product/` contains the approved design assets: a web empty-workspace screenshot, reconstructed Android/iOS Home designs, and desktop renderer status/service screenshots. The native images are not physical-device captures. Desktop status is synthetic and web inventory is empty; captions identify these examples. They contain no customer data and are presentation assets only. Native release/build/device acceptance remains pending as recorded in the platform validation documents. The page makes no download or app-store availability claim.

The page links only to existing sections and workspace/account functionality. Separate documentation, legal, contact, pricing and download pages are outside this increment; the homepage does not expose nonfunctional links or pretend those pages exist. This source implementation does not provision or deploy hosting.

## Product Overview

The `/product` page implements the approved design using Tailwind CSS 4 and the existing local screenshot assets. The homepage header/footer link to it, and its header and final action return to the homepage. Both pages share navigation, typography, button, image-frame and cached copyright-year components. The product-specific header identifies the current page and links to the Applications guide and its local privacy section.

Product section and navigation IDs are distinct from homepage IDs so Next.js cached, hidden routes cannot intercept fragment links or ARIA references during client navigation.

The feature explorer uses four accessible tabs with matching tab/panel IDs, selected state and one tab stop in the tab list. Left/Right wrap between tabs; Home/End select the first/last tab; Tab enters the active panel. The complete feature explanations remain available in the page's sections, including when JavaScript is disabled. The availability disclosure uses native `details`/`summary`.

Device identity/capability/consent diagrams are conceptual, rather than simulated device measurements. Existing empty/synthetic desktop and dashboard screenshots and reconstructed native screens retain their preview captions. No native release, authorization, measured-data or remote-action guarantee is added.

## Applications guide

The `/applications` page implements the approved upright, lavender-and-white design in Tailwind CSS 4. The homepage's “Our apps” navigation, application footer links and Product Overview's application navigation/actions lead to this route. The guide links back to `/` and `/product`; its app-choice cards scroll to unique `applications-*` section IDs, avoiding hidden-route fragment collisions.

`ApplicationPreview` uses the shared screenshot registry and image/frame primitives. Web, Android, iOS and desktop previews open native dialogs with unique React-generated title IDs, Escape dismissal and native focus restoration. The desktop switcher changes both the inline image and enlarged preview. The app-role table uses column/row headers and a labelled, focusable horizontal scroll region on narrow screens; the page itself remains within its viewport. Availability FAQs use native disclosures.

The guide makes no account/monitoring API requests, includes no download links for unvalidated native builds, and retains the platform distinctions and example/synthetic-state captions. No authentication, workspace, backend, native application, collection or process-control behavior changes.
