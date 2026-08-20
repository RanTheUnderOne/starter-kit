# Alphi Installable PWA Design

## Goal

Make the existing Alphi Business Agent dashboard installable from supported mobile and desktop browsers while preserving the current authenticated, network-first application behavior.

## Approved direction

The PWA is installable-only. It will use the Alphi name, logo, and deep-teal theme, open in a standalone app window, and support Add to Home Screen on Android and iOS. It will not provide offline dashboard access, cache authenticated pages, or store agent/user data in a service-worker cache.

## App identity and metadata

- Add an App Router `src/app/manifest.ts` manifest.
- Set the full name to `Alphi Business Agent` and the short name to `Alphi`.
- Use `/` as both the stable app ID and start URL, `standalone` display mode, `#fbfbfc` as the background color, and `#2c6b5c` as the theme color.
- Add 192px and 512px PNG manifest icons derived from the supplied Alphi logo, plus a 180px Apple touch icon.
- Add Apple web-app metadata and a Next.js `Viewport` theme color in the root layout.

## Service worker behavior

- Register a small same-origin service worker from the root layout through a client-only component.
- The worker will activate immediately and claim open clients so updates take effect cleanly.
- The worker will have no fetch handler and will not use the Cache API. Every page, API, authentication, and asset request therefore remains under the browser's normal network and HTTP-cache behavior.
- Serve the worker with headers that prevent a stale worker script from being reused.
- Do not add push notifications, background sync, an install prompt, or offline fallback pages in this change.

## User experience

- Supported browsers can offer their normal Install or Add to Home Screen flow.
- Once installed, Alphi opens without browser chrome in standalone mode and uses the Alphi icon and teal system theme.
- If the device is offline, the application behaves like the current website and may show the browser/network failure state; no private dashboard content is exposed from an offline cache.
- Existing desktop and mobile layouts, navigation, authentication, and Supabase behavior remain unchanged.

## Verification

- Add a deterministic PWA verifier that checks manifest identity/colors/icon declarations, exact icon dimensions, root-layout registration and Apple metadata, worker registration, and absence of Cache API/fetch interception.
- Run the PWA verifier, existing brand and mobile verifiers, typecheck, production build, and `git diff --check`.
- Keep `package-lock.json` out of the commit.
- Commit the PWA implementation separately from the completed mobile work, push it, deploy that exact commit to the existing Vercel production project, and verify the live manifest, icons, worker, and deployment status without visual browser testing.

## References

- Next.js PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- Next.js manifest convention: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
- Next.js app-icon convention: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
