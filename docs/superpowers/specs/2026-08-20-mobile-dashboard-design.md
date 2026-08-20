# Alphi Mobile Dashboard Design

## Goal

Make the complete authenticated Alphi Business Agent experience usable on phone-sized screens without changing English copy, routes, authentication, Agent37/Supabase behavior, or desktop behavior.

## Responsive shell

- At widths below `md`, replace the permanent fleet sidebar with a compact sticky header and a slide-in navigation drawer.
- At widths below `md`, replace the permanent agent workspace rail with a compact header, touch-friendly tab navigation, and a slide-in drawer for agent switching, chat threads, account actions, and the back link.
- Preserve the existing sidebars unchanged at `md` and above.
- Drawers close after navigation and include a backdrop and accessible labels.

## Responsive content

- Render Agents, Members, and Files list data as stacked cards on phones; retain tables on larger screens.
- Allow headings and actions to stack or wrap without horizontal page overflow.
- Reduce chat, integrations, settings, and file-browser padding on small screens.
- Make settings field/button rows stack on phones and make numeric setting grids collapse to one column.

## Verification

- Add a static mobile guard that checks the required responsive shell, drawer, card, and spacing markers.
- Run the guard red before implementation and green afterward.
- Run TypeScript and the production build.
- Per user request, do not perform visual/browser testing for this change.

## Deployment

Commit to `feat/alphi-branding`, push to `RanTheUnderOne/starter-kit`, wait for the connected Vercel deployment to become READY, and promote that exact deployment to production.
