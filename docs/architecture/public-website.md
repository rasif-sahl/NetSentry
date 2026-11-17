# Public website and workspace routes

The approved storytelling homepage is implemented in the existing Next.js dashboard project using its locally compiled Tailwind CSS 4 pipeline. No separate hosting project, CDN stylesheet, remote font or new UI dependency is introduced.

- `/` is the public, statically rendered product homepage. It does not load account or monitoring APIs.
- `/app` contains the existing workspace and its sign-in/register/recovery flows. The homepage's sign-in and workspace actions point here.
- `/verify-email` and `/reset-password` retain their existing URLs and fragment-token handling. Successful sign-in from these flows returns to `/app`.
- Existing `/?view=…` bookmarks redirect to `/app?view=…`, preserving query values. Workspace navigation continues to use its existing `view` query.
- The workspace route group owns the dashboard stylesheet. All its selectors are scoped to `.workspace-app`, including theme overrides, to keep workspace styles separate from the public page during client navigation.

The homepage is a server component, with client components limited to the responsive navigation and product showcases. It preserves the approved straight, aligned screenshots, white/lavender palette, storytelling sections, platform distinctions, consent explanation, setup journey and availability FAQ. The mobile navigation exposes expanded state; screenshot previews use native dialogs with Escape dismissal and focus restoration. Screens do not rotate, tilt or overlap, and buttons contain no arrows.

`dashboard/public/product/` contains the approved design assets: a web empty-workspace screenshot, reconstructed Android/iOS Home designs, and desktop renderer status/service screenshots. The native images are not physical-device captures. Desktop status is synthetic and web inventory is empty; captions identify these examples. They contain no customer data and are presentation assets only. Native release/build/device acceptance remains pending as recorded in the platform validation documents. The page makes no download or app-store availability claim.

The page links only to existing sections and workspace/account functionality. Separate documentation, legal, contact, pricing and download pages are outside this increment; the homepage does not expose nonfunctional links or pretend those pages exist. This source implementation does not provision or deploy hosting.
