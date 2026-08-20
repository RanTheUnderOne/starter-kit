# Alphi Business Agent brand design

## Goal

Rebrand the Agent37 starter-kit dashboard as **Alphi Business Agent** while preserving its existing agent-management, authentication, and data flows.

## Brand source

The product dashboard takes its visual language from the live Alphi business-agents website:

- Hebrew-first, full right-to-left interface.
- Human, operational language rather than generic technical SaaS copy.
- Warm off-white canvas, near-black typography, restrained cream and sage surfaces, and green for active/approved actions.
- Assistant/Rubik-style sans-serif typography, generous whitespace, soft cards, and compact rounded controls.
- The supplied official Alphi mark is the source logo. It must be copied as an asset; do not redraw or replace it with an AI-generated variant.

## Visual system

### Color roles

| Role | Direction |
| --- | --- |
| Canvas | warm off-white matching the marketing site |
| Primary text | charcoal / near-black |
| Positive action | Alphi green |
| Quiet surfaces | cream and pale sage |
| Borders | low-contrast warm gray |
| Destructive states | retain accessible semantic red |

### Typography and layout

- Set document language and direction to Hebrew/RTL.
- Use `Assistant`, then `Rubik`, then system sans-serif fallbacks.
- Keep data, IDs, code, e-mail addresses, and technical values readable in their appropriate direction.
- Preserve responsive behavior and accessibility contrast; color must not be the only status signal.

### Components

- Replace generic product naming with **Alphi Business Agent** in page metadata, authentication pages, invitations, and app chrome.
- Add the official logo in the sidebar/header and authentication surfaces; use its compact mark for constrained contexts.
- Restyle shell, navigation, cards, buttons, badges, inputs, tabs, and empty states to use the visual system.
- Prioritize an operational home view: what Alphi is doing now, items awaiting approval, and agents/processes. Existing routes and API contracts remain unchanged.

## Boundaries

- Branding remains code-side in `src/config/branding.ts` and app styles; no brand-related environment variables.
- No changes to Agent37 calls, Supabase schema, authorization, secrets, or deployment environment variables.
- Do not alter existing dashboard behavior beyond labels and presentation.

## Verification

1. Confirm the official logo renders at normal and compact sizes.
2. Verify RTL layout on login, dashboard, agent workspace, invitation, and password-reset screens.
3. Run `npm run typecheck` and `npm run build`.
4. Deploy a preview and inspect desktop and mobile layouts before promoting production.
