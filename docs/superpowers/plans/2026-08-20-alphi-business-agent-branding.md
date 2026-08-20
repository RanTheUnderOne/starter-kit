# Alphi Business Agent Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the deployed Agent37 starter kit as Alphi Business Agent, using the supplied official logo and the warm Hebrew RTL visual language of the Alphi website.

**Architecture:** Keep all behavior and API contracts intact. Centralize the name and logo URL in the existing branding config; provide the brand palette, typeface, direction, and component defaults through global CSS; then apply the existing tokens and branded shell to entry, fleet, and agent-workspace surfaces.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Lucide React, Supabase SSR.

## Global Constraints

- Product name is exactly `Alphi Business Agent`.
- Use the user-supplied Alphi logo asset; do not generate or redraw a replacement.
- Set Hebrew RTL presentation with `Assistant`, `Rubik`, then `system-ui, sans-serif` fallbacks.
- Keep IDs, e-mail addresses, source code, and other technical strings readable with `dir="ltr"` when rendered.
- Do not change Agent37 API calls, Supabase schema, authentication flow, authorization, or environment variables.
- Preserve accessible focus states and semantic destructive colors.
- Keep the current `package-lock.json` modification out of branding commits unless dependency changes are deliberately required.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `public/alphi-logo.png` | User-supplied official Alphi logo, served as a static asset. |
| `src/config/branding.ts` | One source of truth for product name and static logo URL. |
| `src/app/layout.tsx` | Hebrew document metadata, direction, and typography class. |
| `src/app/globals.css` | Alphi color tokens, RTL-safe base styling, and shared component feel. |
| `src/components/DashboardShell.tsx` | Fleet navigation chrome and Hebrew operational labels. |
| `src/components/AgentWorkspace.tsx` | Per-agent navigation chrome and Hebrew operational labels. |
| `src/app/login/page.tsx` | Branded RTL sign-in, sign-up, and reset copy. |
| `scripts/verify-brand.mjs` | Static guard for the config, logo asset, and RTL global layout contract. |

### Task 1: Establish the official identity asset and brand contract

**Files:**
- Create: `public/alphi-logo.png`
- Create: `scripts/verify-brand.mjs`
- Modify: `src/config/branding.ts:1-8`
- Test: `scripts/verify-brand.mjs`

**Interfaces:**
- Consumes: the official PNG supplied by the user in `C:/Users/Ran/AppData/Local/Temp/codex-clipboard-180b7ee2-46cc-4f1d-b8a5-6d98a81e5cf1.png`.
- Produces: `branding.appName === "Alphi Business Agent"` and `branding.logoUrl === "/alphi-logo.png"` for all existing consumers.

- [ ] **Step 1: Add the failing static brand guard**

Create `scripts/verify-brand.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const branding = fs.readFileSync(path.join(root, "src/config/branding.ts"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");

const required = [
  ['appName: "Alphi Business Agent"', "Alphi Business Agent app name"],
  ['logoUrl: "/alphi-logo.png"', "official logo URL"],
  ['<html lang="he" dir="rtl">', "Hebrew RTL document root"],
];

for (const [needle, label] of required) {
  const source = label === "Hebrew RTL document root" ? layout : branding;
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

if (!fs.existsSync(path.join(root, "public/alphi-logo.png"))) {
  throw new Error("Missing public/alphi-logo.png");
}

console.log("Alphi brand contract verified");
```

- [ ] **Step 2: Run the guard to verify it fails**

Run: `node scripts/verify-brand.mjs`

Expected: failure mentioning the missing Alphi name, RTL root, or logo asset.

- [ ] **Step 3: Copy the approved logo and set the identity configuration**

Copy the user-supplied PNG without alteration:

```powershell
Copy-Item -LiteralPath 'C:\Users\Ran\AppData\Local\Temp\codex-clipboard-180b7ee2-46cc-4f1d-b8a5-6d98a81e5cf1.png' -Destination 'public\alphi-logo.png'
```

Replace `src/config/branding.ts` with:

```ts
export const branding = {
  appName: "Alphi Business Agent",
  logoUrl: "/alphi-logo.png",
} as const;
```

- [ ] **Step 4: Run the guard to verify the identity contract passes**

Run: `node scripts/verify-brand.mjs`

Expected: `Alphi brand contract verified`.

- [ ] **Step 5: Commit the identity asset and config**

```bash
git add public/alphi-logo.png src/config/branding.ts scripts/verify-brand.mjs
git commit -m "feat: add alphi brand identity"
```

### Task 2: Apply Hebrew RTL structure and Alphi design tokens

**Files:**
- Modify: `src/app/layout.tsx:1-20`
- Modify: `src/app/globals.css:1-98`
- Test: `scripts/verify-brand.mjs`

**Interfaces:**
- Consumes: `branding` from Task 1.
- Produces: the shared Tailwind color tokens `background`, `foreground`, `card`, `primary`, `secondary`, `accent`, `border`, and `ring` with the Alphi visual palette.

- [ ] **Step 1: Extend the failing guard with palette assertions**

Add these requirements to the `required` array in `scripts/verify-brand.mjs` and read them from `src/app/globals.css`:

```js
['--background: #fbfbfc', "warm Alphi canvas"],
['--foreground: #111315', "charcoal text"],
['--primary: #2c6b5c', "Alphi action green"],
['font-family: Assistant, Rubik, system-ui, sans-serif', "Alphi type stack"],
```

Update the lookup so the first two branding checks use `branding`, the RTL check uses `layout`, and palette checks use `globals`.

- [ ] **Step 2: Run the guard to verify it fails**

Run: `node scripts/verify-brand.mjs`

Expected: failure mentioning the warm canvas, charcoal text, action green, or type stack.

- [ ] **Step 3: Apply the document root and token implementation**

Replace the root opening tag in `src/app/layout.tsx`:

```tsx
<html lang="he" dir="rtl">
  <body className="min-h-screen bg-background font-sans text-foreground antialiased">
```

Replace the `:root` color declarations in `src/app/globals.css` with this Alphi token block, preserving the existing `@theme inline` mappings and accessibility base layer:

```css
:root {
  --radius: 0.875rem;
  --background: #fbfbfc;
  --foreground: #111315;
  --card: #ffffff;
  --card-foreground: #111315;
  --popover: #ffffff;
  --popover-foreground: #111315;
  --primary: #2c6b5c;
  --primary-foreground: #ffffff;
  --secondary: #efe7de;
  --secondary-foreground: #111315;
  --muted: #f6f6f6;
  --muted-foreground: #6b7278;
  --accent: #d9fdd3;
  --accent-foreground: #111315;
  --destructive: #b42318;
  --destructive-foreground: #ffffff;
  --border: #e5e3df;
  --input: #d9ddd9;
  --ring: #2c6b5c;
}
```

Add this to the existing `@layer base` block:

```css
html { direction: rtl; }
body { font-family: Assistant, Rubik, system-ui, sans-serif; }
input, textarea, [data-ltr] { direction: ltr; text-align: start; }
```

- [ ] **Step 4: Run static and compile verification**

Run: `node scripts/verify-brand.mjs && npm run typecheck`

Expected: `Alphi brand contract verified` and TypeScript exits 0.

- [ ] **Step 5: Commit the shared visual system**

```bash
git add src/app/layout.tsx src/app/globals.css scripts/verify-brand.mjs
git commit -m "feat: apply alphi rtl design tokens"
```

### Task 3: Brand the fleet and agent-workspace navigation

**Files:**
- Modify: `src/components/DashboardShell.tsx:8-59`
- Modify: `src/components/AgentWorkspace.tsx:17-203`
- Test: `scripts/verify-brand.mjs`

**Interfaces:**
- Consumes: `branding.logoUrl`, Alphi tokens from Task 2, and all current route paths/API state.
- Produces: RTL navigation with unchanged route destinations and operation-first Hebrew labels.

- [ ] **Step 1: Add static shell-label checks**

Add a `shell` source read in `scripts/verify-brand.mjs` and assert these literal labels in `DashboardShell.tsx`:

```js
['label: "סוכנים"', "agents navigation label"],
['label: "צוות"', "members navigation label"],
['label: "הגדרות"', "settings navigation label"],
```

- [ ] **Step 2: Run the guard to verify it fails**

Run: `node scripts/verify-brand.mjs`

Expected: failure mentioning an Alphi navigation label.

- [ ] **Step 3: Update shell and workspace presentation without changing navigation behavior**

In `DashboardShell.tsx`, use `border-l` instead of `border-r`, update `NAV` labels to `סוכנים`, `צוות`, `הגדרות`, and use this brand header class:

```tsx
<div className="flex items-center gap-3 rounded-2xl bg-secondary/70 px-3 py-2">
  <img src={branding.logoUrl} alt="Alphi" className="h-9 w-auto object-contain" />
  <span className="truncate text-sm font-bold tracking-tight">{branding.appName}</span>
</div>
```

Keep the existing conditional logo guard and route links. Update active navigation to `bg-primary text-primary-foreground shadow-sm` and inactive navigation to `text-muted-foreground hover:bg-secondary hover:text-foreground`.

In `AgentWorkspace.tsx`, apply the same logo header and change labels to:

```ts
{ id: "chat", label: "שיחה", icon: MessageSquare },
{ id: "files", label: "קבצים", icon: FolderOpen },
{ id: "integrations", label: "חיבורים", icon: Blocks },
{ id: "settings", label: "הגדרות", icon: Settings2 },
```

Replace `Back to all agents` with `לכל הסוכנים`, switch both workspace rails from `border-r` to `border-l`, and change `text-left` on the tab buttons to `text-right`. Do not change `selectTab`, route construction, polling, provider nesting, or visibility behavior.

- [ ] **Step 4: Run verification**

Run: `node scripts/verify-brand.mjs && npm run typecheck`

Expected: static brand checks pass and TypeScript exits 0.

- [ ] **Step 5: Commit navigation branding**

```bash
git add src/components/DashboardShell.tsx src/components/AgentWorkspace.tsx scripts/verify-brand.mjs
git commit -m "feat: brand alphi dashboard navigation"
```

### Task 4: Brand authentication and validate the full production build

**Files:**
- Modify: `src/app/login/page.tsx:13-205`
- Modify: `src/app/reset-password/page.tsx:1-70`
- Modify: `src/app/invite/[token]/page.tsx:1-50`
- Test: `scripts/verify-brand.mjs`

**Interfaces:**
- Consumes: `branding` and global RTL/theme tokens from earlier tasks.
- Produces: Hebrew Alphi presentation while retaining existing Supabase calls and redirect behavior.

- [ ] **Step 1: Add static authentication copy checks**

Add `login` source checks to `scripts/verify-brand.mjs`:

```js
['כניסה לחשבון', "Hebrew sign-in title"],
['יצירת חשבון', "Hebrew sign-up title"],
['איפוס סיסמה', "Hebrew password-reset title"],
```

- [ ] **Step 2: Run the guard to verify it fails**

Run: `node scripts/verify-brand.mjs`

Expected: failure mentioning a Hebrew authentication title.

- [ ] **Step 3: Update only rendered authentication copy and presentation**

Replace `COPY` in `src/app/login/page.tsx` with:

```ts
const COPY: Record<Mode, { title: string; subtitle: string; cta: string; busy: string }> = {
  signin: { title: "כניסה לחשבון", subtitle: "טוב שחזרת.", cta: "כניסה", busy: "מתחברים..." },
  signup: { title: "יצירת חשבון", subtitle: `מתחילים עם ${branding.appName}.`, cta: "יצירת חשבון", busy: "יוצרים חשבון..." },
  reset: { title: "איפוס סיסמה", subtitle: "נשלח לך קישור מאובטח לאיפוס הסיסמה.", cta: "שליחת קישור", busy: "שולחים..." },
};
```

Render the existing logo above the login heading with:

```tsx
{branding.logoUrl ? <img src={branding.logoUrl} alt="Alphi" className="mx-auto h-12 w-auto object-contain" /> : null}
```

Use `text-right` for fields and maintain `dir="ltr"` on the e-mail input. Apply the same logo/header treatment to `reset-password/page.tsx` and `invite/[token]/page.tsx`. Do not change any Supabase method, callback URL, error condition, or navigation destination.

- [ ] **Step 4: Run complete verification**

Run: `node scripts/verify-brand.mjs && npm run typecheck && npm run build`

Expected: brand guard passes, TypeScript exits 0, and Next.js production build exits 0.

- [ ] **Step 5: Commit and deploy a preview**

```bash
git add src/app/login/page.tsx src/app/reset-password/page.tsx src/app/invite/[token]/page.tsx scripts/verify-brand.mjs
git commit -m "feat: localize alphi authentication"
git push origin main
```

Create a Vercel preview deployment from the pushed commit. Verify the logo, RTL rail, fleet navigation, agent workspace, and login page at desktop and mobile widths before promoting the deployment to production.
