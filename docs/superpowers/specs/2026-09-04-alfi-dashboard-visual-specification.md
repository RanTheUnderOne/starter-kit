# Visual Mockup & Design Specification: Alfi Agents Dashboard (2026)

**Task ID:** `t_b5085c3a`  
**Parent Task:** `t_105a3c6f`  
**Target Implementation Task:** `t_9a401c73`  
**Workspace:** `RanTheUnderOne/starter-kit`  
**Date:** September 4, 2026  
**Status:** Approved Specification & Implementation Blueprint  

---

## 1. Executive Summary & Design System Foundation

This design specification synthesizes the comprehensive UI audit (`docs/superpowers/specs/2026-09-03-starter-kit-ui-audit.md`) and the cited 2026 AI web app design research brief (`docs/superpowers/specs/2026-09-04-ai-web-design-research.md`).

The **Alfi Agents Dashboard** is the command interface for business owners interacting with digital employee Alfi (powered by Agent37 and Hermes). Following the core project rules:
1. **Preserve existing layout foundations where they work** while eliminating jarring color collisions, border-radius chaos, and layout shifts.
2. **Strictly native to starter-kit and Agent37/Hermes primitives**: pure Tailwind CSS v4, existing Radix/shadcn UI controls, Next.js 16 App Router, and native Agent37 endpoints (`/v1/responses`, `/v1/cron`, Kapso WhatsApp, Composio toolkits). No heavy foreign dependencies.
3. **Calm, token-driven supervision surface**: agent status, activity, and recovery are legible without turning the conversational interface into a confusing observability console.

---

## 2. Color Tokens & Semantic Theme Architecture

### A. Semantic Mapping (`@theme inline` in `globals.css`)
We eliminate ad-hoc hex values (`#072f2e`, `#b8f0d4`, `#d9f5e8`, `#fbf8ef`, `text-teal-950`) by elevating Alfi brand colors into unified semantic variables in OKLCH/sRGB space.

| Token Name | Light Mode Value | Dark Mode Value | Semantic Role & Application |
|---|---|---|---|
| `--background` | `oklch(0.985 0.012 87)` (Warm Cream / `#fbf8ef`) | `oklch(0.141 0.005 285.8)` (Deep Slate-Ink) | Outer viewport background |
| `--foreground` | `oklch(0.235 0.045 178)` (Deep Alfi Ink / `#0b3b3a`) | `oklch(0.985 0 0)` (Pure Off-White) | Primary reading text & titles |
| `--card` | `oklch(0.998 0.005 87)` (Pure Card White) | `oklch(0.21 0.006 285.8)` (Surface Dark) | Primary surface panels & cards |
| `--card-foreground` | `oklch(0.235 0.045 178)` | `oklch(0.985 0 0)` | Card text |
| `--primary` | `oklch(0.28 0.065 178)` (Brand Deep Teal) | `oklch(0.92 0.004 286.3)` (Light Mint-White) | Primary action buttons, active tabs |
| `--primary-foreground`| `oklch(0.99 0.01 85)` (Clean Cream) | `oklch(0.21 0.006 285.8)` | Text inside primary buttons |
| `--secondary` | `oklch(0.94 0.035 166)` (Soft Mint Tint) | `oklch(0.274 0.006 286.0)` | Subtle backdrops, user chat bubbles |
| `--secondary-foreground`| `oklch(0.28 0.06 178)` (Deep Ink) | `oklch(0.985 0 0)` | Text inside secondary blocks |
| `--muted` | `oklch(0.96 0.012 87)` | `oklch(0.274 0.006 286.0)` | Dividers, disabled state, subtle backgrounds |
| `--muted-foreground` | `oklch(0.50 0.035 177)` (~60% Ink tone) | `oklch(0.705 0.015 286.0)` | Subtitles, timestamps, metadata |
| `--border` | `oklch(0.89 0.025 174)` (10% Ink tone) | `oklch(1 0 0 / 12%)` | Card borders, table dividers |
| `--brand-deep` | `#072f2e` (Deep Emerald Night) | `#041c1b` | Workspace desktop rail anchor |
| `--brand-mint` | `#b8f0d4` (Luminous Alfi Mint) | `#256653` | Selected focus rings, active badge wash |
| `--brand-amber` | `#f5ba66` (Calm Amber) | `#d97706` | Warning status, review-required badge |

### B. Status Badge & Indicator Colors
- **Ready / Active / Healthy**: Soft emerald wash (`bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20`).
- **Working / Connecting / Running**: Pulse-capable teal-blue wash (`bg-primary/10 text-primary border-primary/20`).
- **Needs Review / Paused / Degraded**: Amber wash (`bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20`).
- **Disconnected / Failed / Error**: Soft red wash (`bg-destructive/10 text-destructive border-destructive/20`).

---

## 3. Spacing Scale, Radii & Layout Hierarchy

### A. Predictable 4px Spacing Scale
- `4px` (`gap-1`, `p-1`): Micro-spacers, icon-to-label offsets, status dots.
- `8px` (`gap-2`, `p-2`): Input button paddings, inline tags, attachment chips.
- `12px` (`gap-3`, `p-3`): Card headers, tool execution items.
- `16px` (`gap-4`, `p-4`): Mobile view gutters, small card padding, table cells.
- `20px`–`24px` (`gap-5`/`6`, `p-5`/`6`): Standard panel interior padding, desktop card padding.
- `32px` (`p-8`, `space-y-8`): Tab sections, empty-state containers.

### B. Unified Corner Radius Scale
The audit revealed clashes between `rounded-md` (6px) buttons inside `rounded-[28px]` cards. We standardize into a 4-tier hierarchy:
1. **Control Radius (`rounded-lg` - 8px / 10px)**: Buttons, inputs, search fields, tool chips.
2. **Container Radius (`rounded-xl` - 12px / 14px)**: Nested elements, dialogs, dropdown menus, user chat bubbles.
3. **Card Radius (`rounded-2xl` - 16px)**: Standard content cards, schedule items, integrations, fleet cards, and `.alfi-panel`.
4. **Pill (`rounded-full`)**: Status badges, icon buttons (Send, Stop, New Chat), avatars.

---

## 4. Visual Mockups & Component Specifications

### Mockup 1: Global Fleet & Workspace Navigation (`DashboardShell` & `AgentWorkspace`)

```
+---------------------------------------------------------------------------------------------------+
|  [A] Alfi Workspace            [All Assistants v]                    [he/EN]  (Account)           |
+----------------------+----------------------------------------------------------------------------+
|  <- All assistants   |  Your Assistants                                      [+ New Assistant]   |
|                      |  Open Alfi to keep customer communication and scheduled work moving.       |
|  [Active Agent v]    |                                                                            |
|  * Alfi Main (Ready) |  +--------------------------+  +--------------------------+  +-----------+ |
|                      |  | [A] Alfi (Sales & Lead)  |  | [A] Alfi Support         |  | [A] Night | |
|  NAVIGATION          |  | Status: Ready            |  | Status: Connecting       |  | Status:   | |
|  [x] Chat            |  | Model: GPT-5.6 Codex     |  | Model: Claude 3.5 Sonnet |  | Ready     | |
|  [ ] Schedules       |  | WhatsApp: Connected      |  | WhatsApp: Not Configured |  | Sched: 2  | |
|  [ ] WhatsApp        |  | Last active: 4m ago      |  | Last active: 2h ago      |  | 02:30 AM  | |
|  [ ] Business        |  |                          |  |                          |  |           | |
|  [ ] Advanced (Staff)|  | [ Open Chat ]   [...]    |  | [ Open Chat ]   [...]    |  | [ Open ]  | |
|                      |  +--------------------------+  +--------------------------+  +-----------+ |
|  CHATS               |                                                                            |
|  + Today             |                                                                            |
|    Morning Pipeline  |                                                                            |
|    Fireberry Sync    |                                                                            |
|  + Yesterday         |                                                                            |
|    WhatsApp Inquiries|                                                                            |
+----------------------+----------------------------------------------------------------------------+
```

#### Specification Details:
1. **Desktop Rail Unified Width:** `w-64` (256px) or `w-66` (264px) across both `DashboardShell` and `AgentWorkspace`. Eliminates the current abrupt 240px -> 288px jump.
2. **Rail Theme Integration:** The deep brand rail (`bg-[#072f2e]`) stays clean with calibrated semantic tokens (`--border: rgba(255,255,255,0.08)`, `--muted-foreground: rgba(244,251,247,0.65)`).
3. **Mobile Header & Bottom Navigation Bar:**
   - Standardized `h-14` header with `backdrop-blur-md bg-background/80 border-b`.
   - Unified mobile bottom navigation with safe-area calculation: `h-14 pb-[env(safe-area-inset-bottom)]`.
   - Replaces disparate `pb-28` and `pb-[calc(5.25rem+...)]` with a shared utility class `pb-safe-nav`.

---

### Mockup 2: Agent Fleet Card Anatomy (`FleetAgentCard`)

```
+----------------------------------------------------------------------+
| [Icon] Alfi (Lead Ops & Support)                    [ Ready / Active ] |
|                                                                      |
| Role: Inbound Lead Qualification & Fireberry CRM Sync                |
| Model: Default (Managed)      vCPU: 2 | RAM: 4GB      Disk: 20GB     |
|                                                                      |
| WhatsApp: +972 50-123-4567 (Connected)                               |
| Last Activity: Completed morning lead digest 14 mins ago             |
+----------------------------------------------------------------------+
| [ Message Alfi ]               [ Open Port v ]         [ Settings ]  |
+----------------------------------------------------------------------+
```

#### Specification Details:
1. **Responsive Card Grid:**
   - `< 768px`: 1 column.
   - `768px – 1280px`: 2 columns.
   - `≥ 1280px`: 3 columns.
2. **Card Structure:**
   - **Header:** Identity row with 40x40px avatar icon, agent display name, and clear status badge (`Ready`, `Working`, `Needs Review`, `Stopped`).
   - **Body:** Concise role/description + high-value metadata chips (WhatsApp status, runtime resources, last active timestamp).
   - **Footer Action Bar:** Clear visual hierarchy: primary `Chat` / `Open`, auxiliary port launch buttons, and admin dropdown menu (`Rename`, `Restart`, `Delete`).

---

### Mockup 3: Conversational Workspace & Stable Composer (`ChatView`)

```
+---------------------------------------------------------------------------------------------------+
|  Chat: Morning Lead Inquiries                                                  [ + New Chat ]     |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|                                     [ A ]                                                         |
|                             YOUR BUSINESS ASSISTANT                                               |
|                                  Talk to Alfi                                                     |
|                                                                                                   |
|    Prompt Starters (Real Capabilities):                                                           |
|    [ Lead Status Summary ]   [ Follow-up Queue ]   [ Sync CRM Leads ]   [ Review WhatsApp Log ]   |
|                                                                                                   |
|  -----------------------------------------------------------------------------------------------  |
|                                                                                                   |
|  [User Bubble: Check follow-ups for today]                                                        |
|                                                                                                   |
|  [Alfi Turn]                                                                                      |
|  +-- [v] Thought process (0.8s) -------------------------------------------------------------+   |
|  | Checked scheduled follow-ups via CRM query. 4 leads pending contact today.                 |   |
|  +-------------------------------------------------------------------------------------------+   |
|  +-- [Wrench] fireberry_get_leads (completed, 0.4s) -----------------------------------------+   |
|                                                                                                   |
|  Here are the 4 priority leads requiring owner follow-up before 14:00 today:                      |
|  1. David Cohen - Requested pricing for enterprise tier                                           |
|  2. Maya Levin - WhatsApp callback requested                                                      |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
|  (Fade Dissolve Area)                                                                             |
|  +---------------------------------------------------------------------------------------------+  |
|  |  Ask Alfi anything about your business...                                                   |  |
|  |                                                                                             |  |
|  |  [+] [Model: Default v] [Effort: Med v]                                      (^) [Send]     |  |
|  +---------------------------------------------------------------------------------------------+  |
|  Stable width: max-w-3xl | Padding: 16px | Radius: 16px (rounded-2xl)                             |
+---------------------------------------------------------------------------------------------------+
```

#### Specification Details:
1. **Zero Layout Shift:**
   - The composer wrapper maintains a constant `max-w-3xl` width in both empty (welcome) and populated conversation states.
   - Eliminates the current snap between `max-w-2xl` and `max-w-3xl`.
2. **Capability-Accurate Prompt Starters:**
   - When the conversation is empty, display 3–4 actionable starter chips mapped directly to native capabilities:
     - *"Summarize today's inbound leads"*
     - *"Check pending WhatsApp follow-ups"*
     - *"Run morning business briefing"*
     - *"Review scheduled actions"*
   - Clicking a chip fills and dispatches the query through the existing `onSend` callback.
3. **Structured Assistant Turn Anatomy:**
   - Clear visual anchor for assistant responses.
   - Collapsible thinking process and unified tool execution chips (`ToolChip`) styled with semantic border tokens (`border-border/60 bg-card/60 rounded-lg`).

---

### Mockup 4: Unified Tab Header Standard (`TabHeader`)

Every tab currently hardcodes ad-hoc text styles:
```tsx
// BEFORE (hardcoded in WhatsAppTab, BusinessTab, AdvancedTab):
<p className="text-[11px] font-bold tracking-[0.2em] text-teal-700">...</p>
<h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-teal-950 sm:text-4xl">...</h1>
<p className="mt-2 max-w-2xl text-sm leading-6 text-teal-950/60">...</p>
```

```
+---------------------------------------------------------------------------------------------------+
|  EYEBROW (text-xs font-semibold tracking-widest text-primary/80 uppercase)                        |
|  Page / Tab Title (text-2xl sm:text-3xl font-semibold tracking-tight text-foreground)            |
|  Subtitle description (text-sm text-muted-foreground max-w-2xl leading-relaxed)                   |
+---------------------------------------------------------------------------------------------------+
```

#### Specification Details:
- Standardized `TabHeader` component with props: `eyebrow`, `title`, `description`, and optional `actions` slot (e.g. `[+ Add Schedule]`).
- Replaces duplicate code across `WhatsAppTab`, `BusinessTab`, `SchedulesTab`, and `AdvancedTab`.

---

### Mockup 5: Schedules & Supervision Timeline (`SchedulesTab`)

```
+---------------------------------------------------------------------------------------------------+
|  AUTOMATIC WORK                                                                                   |
|  Schedules                                                                   [ + Add Schedule ]   |
|  Alfi runs checks on your schedule and brings actionable results back here.                       |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | [Clock] Morning Lead Triage & Executive Digest                          [ Status: Scheduled ]|  |
|  | Prompt: "Run lead qualification check on all new inquiries and compile a summary."           |  |
|  |                                                                                             |  |
|  | [Next Run: Tomorrow, 08:00]                 [Last Run: Today, 08:00 (Success)]              |  |
|  |                                                                                             |  |
|  | [ Run Now ]   [ Pause ]   [ Edit ]   [ Delete ]                                             |  |
|  +---------------------------------------------------------------------------------------------+  |
|  | [v] Recent Execution Results                                                                |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  |  | Today 08:00 - COMPLETED (Ran in 4.2s)                                                 |  |  |
|  |  | 3 new inbound leads triaged; 1 qualified as urgent.                                   |  |  |
|  |  | [ Continue with Alfi in Chat -> ]                                                     |  |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

#### Specification Details:
1. **Container Styling:** Change from `rounded-[28px]` to `rounded-2xl border bg-card shadow-sm`.
2. **Timeline Run Items:** Clean, monospaced metadata badge (`COMPLETED`, `FAILED`, `RUNNING`) with 12px muted timestamp, structured summary text, and a native `Continue with Alfi` shortcut that prefills chat context.

---

## 5. File-by-File Implementation Plan for `t_9a401c73`

| File | Target Changes |
|---|---|
| `src/app/globals.css` | 1. Update CSS custom properties to elevate brand colors into semantic variables.<br>2. Calibrate `.alfi-panel` with modern subtle elevation (`shadow-sm`, `rounded-2xl`).<br>3. Add `.pb-safe-nav` utility for consistent mobile scroll offsets. |
| `src/components/TabHeader.tsx` | Create unified, accessible tab header component (`eyebrow`, `title`, `subtitle`, `actions`). |
| `src/components/AgentCard.tsx` | Create reusable 2026 agent status card for both customer fleet and responsive staff view. |
| `src/components/AgentsView.tsx` | Replace raw 28px empty panels and non-responsive staff table with `AgentCard` grid + toggle. |
| `src/components/DashboardShell.tsx` | Align sidebar width to `w-64` and standardize padding with `AgentWorkspace`. |
| `src/components/AgentWorkspace.tsx` | Align desktop sidebar to `w-64`, harmonize dark token variables, and use `pb-safe-nav`. |
| `src/components/chat/ChatView.tsx` | Fix composer width to constant `max-w-3xl`; add capability prompt starter chips in welcome state. |
| `src/components/chat/ChatComposer.tsx` | Standardize inner input bounds, border focus styling, and button dimensions. |
| `src/components/chat/ChatMessages.tsx` | Harmonize bubble radius (`rounded-2xl` / `rounded-xl`), tool chips, and thinking blocks. |
| `src/components/WhatsAppTab.tsx` | Adopt `TabHeader`, replace `pb-28` with `pb-safe-nav`, refine card radii. |
| `src/components/BusinessTab.tsx` | Adopt `TabHeader`, remove nested card border double-padding. |
| `src/components/SchedulesTab.tsx` | Adopt `TabHeader`, standardize card radius to `rounded-2xl`, polish run history timeline. |
| `src/components/WhatsAppStatusSection.tsx` | Standardize section containers to `rounded-2xl`, align button styles and badge indicators. |

---

## 6. Verification and Acceptance Criteria

1. **Visual Consistency Check**:
   - Switching between `/dashboard` and `/dashboard/agents/[id]/chat` exhibits no sidebar width jump.
   - Sending the first message in Chat causes zero horizontal composer expansion or layout shifting.
   - Corner radii are consistent (`rounded-2xl` for cards, `rounded-lg` for inputs/buttons).
2. **Native Compliance**:
   - Zero additional npm dependencies introduced.
   - All prompt starters trigger native `/v1/responses` queries via `onSend`.
   - All scheduled tasks and status indicators map strictly to existing Agent37 / Hermes APIs.
3. **Build & Typecheck Gate**:
   - `npm run typecheck` passes with zero errors.
   - `npm run build` succeeds cleanly.
   - Existing Vitest suite (`tests/`) passes without regressions.
