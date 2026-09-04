# 2026 AI Web App Design Research Brief

**Audience:** Alfi Agents Dashboard implementation team  
**Research date:** 2026-09-04  
**Scope:** Current agent-product interaction patterns, visual systems, layout, typography, motion, and implications for the existing native Next.js/Tailwind/Radix starter-kit.

## Executive summary

The most durable 2026 direction is not “make the UI more futuristic.” It is a calm, token-driven control surface that makes agent identity, current status, actions, uncertainty, and recovery legible. Agent experiences should preserve chat as an efficient intent channel while adding native supervision surfaces for long-running or consequential work. Microsoft’s agent guidance explicitly frames the experience as a complete interaction system spanning first use, active interaction, failure, and recovery—not merely a prompt and response.[1][2]

For Alfi, the recommended design is a restrained light-first workspace with a deep-teal brand anchor, semantic surface tokens, a 260–264px desktop rail, 4px-derived spacing, a stable max-width composer, and compact status/activity modules. Keep the existing feature model and native API routes; improve coherence and visibility rather than introducing a new product shell.

## What is evidence-backed vs. judgment

**Evidence-backed:** Microsoft recommends clear capabilities and limitations, editable outputs, visible controls, transparent status, consistency, accessibility, responsiveness, and token-based theming.[1][2] Its foundational agent-home guidance identifies title bar, icon, name, attribution, chat input, and prompt starters as core first-run elements.[3] Radix documents a 4px-based space scale (4, 8, 12, 16, 24, 32, 40, 48, 64px) and a coordinated nine-step type scale.[4][5] Vercel’s Geist system similarly separates headings, labels, copy, button styles, and mono text into reusable roles.[6][7] Microsoft’s HAX Toolkit describes its guidance as evidence-based and synthesized from more than 20 years of research.[8]

**Interpretation for this product:** A dashboard should make supervision visible without turning every response into an observability console. The following proportions, palette mapping, and component priorities are design recommendations derived from those principles plus the repository audit; they are not universal standards.

## 1. Product pattern: chat plus control surface

### Recommended information architecture

1. **Agent identity bar:** icon, concise purpose/name, attribution or workspace context, current status, and primary actions.
2. **Conversation surface:** streaming responses, prompt starters on empty state, editable user intent, retry/regenerate, and source/evidence affordances when available.
3. **Contextual activity surface:** collapsible tool/status timeline for active work; show current step and completed steps, not hidden “thinking.”
4. **Persistent task state:** for scheduled or asynchronous work, expose run status, last activity, next action, and pause/stop/retry where the existing API supports it.
5. **Settings and integrations:** keep deeper configuration out of the primary chat flow; reveal it through the existing tabs.

Microsoft specifically recommends prompt starters that reflect real capabilities, use action-oriented language, and remain short; it also recommends visible controls for refinement and correction pathways rather than forcing users to restart.[1][3] Streaming feedback is a useful latency pattern, while citations and AI labels help users distinguish generated content and inspect provenance.[1][3]

### Patterns to adopt now

- **Prompt starters:** 3–4 compact chips on the welcome state, each mapped to a real supported task.
- **Explicit state:** `Ready`, `Working`, `Needs review`, `Paused`, `Error`, and `Offline` should be visually distinct and text-labeled; never communicate status through color alone.
- **Progressive disclosure:** default to a concise answer; provide expandable activity/tool details and evidence rather than permanently showing internal complexity.
- **Action ownership:** label actions as user-initiated (“Run,” “Approve,” “Retry,” “Stop”) and retain a clear recovery path.
- **Non-blocking long work:** allow navigation or continued conversation while work runs when backend semantics permit; surface completion and failure in the activity module.
- **Receipts for mutations:** when an action changes files, integrations, schedules, or external systems, show what changed and where; only add rollback affordances when a real API path exists.

### Patterns to avoid

- Chat-only progress for multi-step or asynchronous work.
- Decorative “AI glow,” pulsing gradients, or animated reasoning that imply confidence without evidence.
- Recreating chat, tabs, or settings inside a widget; keep each surface focused.
- Hard-coded one-off colors and radii that bypass the semantic token system.
- Autonomous actions without a visible status, confirmation boundary, or failure recovery.

## 2. Layout and proportions

### Desktop (recommended baseline)

| Region | Recommendation | Rationale |
|---|---:|---|
| Global/agent rail | 260–264px fixed | Removes the current 240px/288px jump while leaving room for labels and agent identity. |
| Main content gutter | 24px at laptop, 32px at wide desktop | Uses the documented 4px-derived scale and preserves breathing room. |
| Content max width | 1200–1280px for fleet pages; 960–1120px for focused chat | Prevents sparse, floating content on large monitors. Judgment call. |
| Chat reading column | 720–800px | Keeps prose comfortable while reserving room for a contextual activity pane if needed. Judgment call. |
| Composer | stable `max-w-3xl` (or ~768px), min-height 72–80px on empty state | Prevents the current empty/active width shift. Judgment call based on the audit. |
| Fleet grid | 3 columns at ≥1200px, 2 at 760–1199px, 1 below 760px | Gives status cards enough content density without oversized empty panels. |
| Card padding | 20–24px | Aligns with the 4px scale and avoids the current 28px-card/6px-control mismatch. |

Radix separates layout responsibilities into box, flex, grid, section, and container primitives, which supports explicit sizing constraints and responsive behavior rather than ad-hoc offsets.[4] Its spacing scale is a useful local contract: use 4px for icon alignment, 8–12px for control internals, 16–24px for component padding, and 32–64px for section separation.[5]

### Responsive behavior

- **Compact/mobile:** collapse the rail into the existing bottom navigation or drawer; keep a 44px-or-larger effective touch target and 8px separation between adjacent actions. Treat this as an accessibility requirement to validate in implementation, not a claim that every current control meets it.
- **Tablet:** retain the identity bar and stack fleet cards; move secondary activity details below the conversation instead of forcing a narrow split view.
- **Wide desktop:** use a centered content container; add an optional supporting activity pane only when it contains active, relevant work.
- **Safe-area consistency:** define one bottom-navigation offset token and use it in all mobile tabs instead of per-view `pb-*` guesses.

## 3. Visual direction and tokens

### Recommended Alfi semantic palette

Preserve the recognizable Alfi teal/mint/cream character, but expose it through semantic variables rather than inline hex utilities.

| Token role | Suggested value | Use |
|---|---|---|
| `surface-0` | warm cream/near-white | app background |
| `surface-1` | white or slightly tinted white | cards and navigation |
| `surface-2` | pale mint tint | selected/positive regions |
| `ink-strong` | deep teal | headings and primary text |
| `ink-muted` | teal/ink at ~60% opacity | secondary copy |
| `brand` | deep Alfi teal | primary action, active navigation |
| `brand-soft` | mint | subtle selected state and focus wash |
| `status-success` | accessible green | ready/healthy |
| `status-warning` | amber | needs review or degraded |
| `status-danger` | red | error/blocked |
| `status-info` | blue/teal | informational state |
| `border-subtle` | ink at 8–12% | card boundaries |

These values should be implemented as the project’s existing OKLCH/Tailwind semantic tokens, with an explicit dark-mode mapping if dark mode remains supported. Avoid mixing `text-teal-950`, arbitrary Alfi hex classes, and unrelated OKLCH roles in the same component. Microsoft’s guidance favors reusable components and theming tokens over hard-coded styles for consistency and future maintenance.[1]

### Light and dark treatment

- **Light-first default:** warm cream background, white surfaces, deep teal type, mint selected states, and restrained amber warnings. This fits the existing Alfi identity and improves fleet scanning.
- **Dark mode:** use deep teal/charcoal surfaces with off-white text; map borders to white at low opacity; retain mint only for active/positive emphasis. Do not invert every surface to saturated green.
- **Depth:** prefer tonal surface steps and 1px borders; use ambient shadows sparingly. Reserve stronger elevation for menus, dialogs, and the active composer.
- **Contrast:** status must include text/icon/shape in addition to hue. Validate text and focus states with an accessibility checker during implementation.

### Shape and radius hierarchy

Use a small, predictable scale: `sm: 8px` for badges and compact controls, `md: 12px` for inputs and popovers, `lg: 16px` for cards and message groups, `xl: 20px` for composer/dialogs, and full pill only for tags or status indicators. This is a local recommendation intended to replace the current arbitrary 18/20/24/28px mixture.

## 4. Typography

Use one primary UI sans stack and one mono stack for technical metadata. Choose the currently bundled/project-approved face; do not add a font dependency solely for trend alignment. The key is role consistency.

| Role | Size / line-height | Weight | Example |
|---|---:|---:|---|
| Page title | 28/36 or 32/40 | 600–700 | Fleet or agent workspace title |
| Section title | 20/28 or 24/30 | 600 | Activity, integrations |
| Body | 14/20 or 16/24 | 400 | Descriptions and responses |
| Label | 12/16 or 13/18 | 500–600 | Tabs, metadata, status labels |
| Button | 14/20 | 500–600 | Primary and secondary actions |
| Mono metadata | 12/16 or 13/18 | 400–500 | run IDs, timestamps, tool names |

Radix’s official type scale pairs each size with line height and letter spacing, rather than treating font size as an isolated variable; its documented values range from 12/16 through 60/60.[4] Geist likewise packages typography into named roles for headings, labels, copy, buttons, and mono text.[6] For Alfi, use tighter tracking only in large headings and small uppercase eyebrows; keep response text at a generous line height and a readable measure.

## 5. Motion and micro-interactions

Motion should communicate state, continuity, and causality—not decorate idle screens.

- **Streaming:** use a subtle caret/progress treatment while a response arrives; transition to stable content without a layout jump.
- **Status change:** animate the status dot or icon once on transition; avoid infinite pulses except for genuinely active work, and keep the label visible.
- **Expand/collapse:** animate height/opacity with a short, interruptible transition; preserve scroll position.
- **Button feedback:** use pressed/focus states immediately; disable duplicate submissions while a request is in flight.
- **Success/error:** show an inline status with recovery action; do not rely on toast-only feedback for consequential changes.
- **Respect reduced motion:** disable nonessential transforms and looping animation under `prefers-reduced-motion`.

Material 3 Expressive describes motion-physics and emphasized typography as ways to direct attention, but the source is a design-system direction rather than a mandate for web implementation.[9] For this starter-kit, the safer choice is restrained CSS transitions using existing utilities and components, not a new animation library.

## 6. Agent fleet and status cards

Each card should answer five questions at a glance: **which agent, what can it do, is it available, what happened recently, and what can I do next?**

Suggested anatomy:

1. **Identity row:** icon/avatar, concise name, type/attribution.
2. **Status row:** text label plus semantic icon/dot (`Ready`, `Working`, etc.).
3. **Metadata chips:** last active time, current model or template if already available, and one resource/budget indicator only if trustworthy.
4. **Recent activity:** one short event or “No recent activity”; avoid fabricated uptime metrics.
5. **Action row:** primary `Open`/`Chat`, plus an overflow menu for existing actions.

For a staff table, preserve sortable/tabular utility but group actions and provide a responsive stacked card fallback below the current overflow breakpoint. For end users, use the same status-card primitive instead of large mostly-empty panels. Agent identity, name, attribution, and prompt starters are specifically called out as trust-building home-page elements in Microsoft’s guidance.[3]

## 7. Implementation sequence for starter-kit

**Phase 1 — token and shell coherence:** consolidate colors, widths, radii, focus styles, and mobile bottom offset. Extract a shared `TabHeader`/`PageHeader` without changing routes or APIs.

**Phase 2 — chat stability:** make composer width constant, add capability-accurate prompt starters, standardize message/tool states, and make active status explicit.

**Phase 3 — fleet density:** build one reusable agent status card; use it for customer fleet and the responsive staff fallback; preserve the existing staff table on wide screens.

**Phase 4 — supervision affordances:** improve existing tool chips/run history into a compact activity timeline, with expandable details and clear recovery actions only where upstream APIs support them.

**Phase 5 — verification:** test desktop/tablet/mobile widths, keyboard focus, reduced motion, loading/error/empty states, and `npm run typecheck` plus `npm run build`. Do not add a dependency unless an existing primitive cannot satisfy the requirement.

## Decision checklist

- Does every special action map to an existing Agent37 endpoint or installed Hermes skill?
- Is the agent’s current status visible without interpreting animation?
- Can a user correct, retry, stop, or safely recover where the operation supports it?
- Are source/evidence details available on demand without forcing long explanations?
- Does the layout stay stable between empty and active chat states?
- Are color, spacing, typography, and radius decisions semantic and reusable?
- Does mobile use one consistent safe-area strategy?
- Are claims about uptime, model, budget, or completion backed by real data rather than decorative placeholders?

## Methodology and limitations

This brief triangulates official Microsoft agent UX guidance, Microsoft’s HAX Toolkit, Radix Themes documentation, Vercel’s public Geist documentation, and Material 3 Expressive documentation, then applies those principles to the repository audit already produced for starter-kit. The “2026 trends” label is necessarily forward-looking: design practice is evolving, and vendor guidance is normative rather than proof that every product should copy one visual style. Proportions and Alfi token values marked as recommendations are judgment calls for this codebase, not measured universal benchmarks.

## Sources

[1] https://learn.microsoft.com/en-us/agents/design-guidelines/human-centered-design
[2] https://microsoft.design/articles/ux-design-for-agents
[3] https://learn.microsoft.com/en-us/agents/design-guidelines/foundational-customizations-for-agents
[4] https://www.radix-ui.com/themes/docs/theme/typography
[5] https://www.radix-ui.com/themes/docs/theme/spacing
[6] https://vercel.com/geist/introduction
[7] https://vercel.com/geist/typography
[8] https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines
[9] https://m3.material.io/blog/building-with-m3-expressive
