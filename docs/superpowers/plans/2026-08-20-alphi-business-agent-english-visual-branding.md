# Alphi Business Agent English Visual Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the Alphi Business Agent name, official supplied logo, and Alphi color system while preserving the existing English LTR UI and every existing behavior.

**Architecture:** The existing config owns the product name and logo path. Global CSS supplies the visual tokens. Existing shell, workspace, and authentication components consume those values without changing routes, copy, direction, APIs, or auth logic.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4.

## Global Constraints

- Product name is exactly `Alphi Business Agent`.
- Use the supplied Alphi logo as-is; do not generate or redraw it.
- Retain English, LTR, all existing labels, routes, and behavior.
- Do not modify Agent37 APIs, Supabase code/schema, authentication behavior, secrets, or Vercel variables.
- Do not stage `package-lock.json`.

### Task 1: Add the official identity and Alphi visual tokens

**Files:**
- Create: `public/alphi-logo.png`
- Create: `scripts/verify-brand.mjs`
- Modify: `src/config/branding.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces `branding.appName === "Alphi Business Agent"`.
- Produces `branding.logoUrl === "/alphi-logo.png"`.

- [ ] Copy `C:\Users\Ran\AppData\Local\Temp\codex-clipboard-180b7ee2-46cc-4f1d-b8a5-6d98a81e5cf1.png` to `public\alphi-logo.png` without changing it.
- [ ] Create a `scripts/verify-brand.mjs` static guard that fails unless the branding config contains the exact name and `/alphi-logo.png`, the PNG exists, and `globals.css` contains `--background: #fbfbfc` and `--primary: #2c6b5c`.
- [ ] Run `node scripts/verify-brand.mjs` and record its expected initial failure.
- [ ] Set `src/config/branding.ts` to export `appName: "Alphi Business Agent"` and `logoUrl: "/alphi-logo.png"`.
- [ ] Replace only the `:root` color tokens in `src/app/globals.css` with warm Alphi values: background `#fbfbfc`, foreground `#111315`, card `#ffffff`, primary `#2c6b5c`, secondary `#efe7de`, accent `#d9fdd3`, border `#e5e3df`, input `#d9ddd9`, and accessible destructive `#b42318`; retain all LTR and dark-mode behavior.
- [ ] Run `node scripts/verify-brand.mjs && npm run typecheck`; expected: guard success and TypeScript exit 0.
- [ ] Commit only `public/alphi-logo.png`, `scripts/verify-brand.mjs`, `src/config/branding.ts`, and `src/app/globals.css` with message `feat: add alphi brand identity`.

### Task 2: Render the logo and visual system in existing English screens

**Files:**
- Modify: `src/components/DashboardShell.tsx`
- Modify: `src/components/AgentWorkspace.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/reset-password/page.tsx`
- Modify: `src/app/invite/[token]/page.tsx`
- Modify: `scripts/verify-brand.mjs`

**Interfaces:**
- Consumes `branding.logoUrl` and the color tokens from Task 1.
- Preserves English text, `border-r`, `text-left`, routes, Supabase calls, and callback behavior.

- [ ] Extend the static guard so each visible shell and authentication surface renders `branding.logoUrl` with `alt="Alphi"`.
- [ ] Run `node scripts/verify-brand.mjs` and record its expected initial failure.
- [ ] In `DashboardShell.tsx` and `AgentWorkspace.tsx`, retain the current navigation labels, LTR classes, and routes. Replace only the logo row with an official-logo image (`h-9 w-auto object-contain`) inside a `rounded-2xl bg-secondary/70` header, and use `bg-primary text-primary-foreground shadow-sm` for active navigation.
- [ ] In the login, reset-password, and invite pages, render the official logo above the existing English product heading. Do not change the existing English `COPY`, form fields, Supabase methods, redirects, or direction.
- [ ] Run `node scripts/verify-brand.mjs && npm run typecheck && npm run build`; expected: all commands exit 0.
- [ ] Commit only Task 2 files with message `feat: render alphi application brand`.

### Task 3: Verify the visual deployment

- [ ] Push `feat/alphi-branding` to the configured `RanTheUnderOne/starter-kit` fork.
- [ ] Create a Vercel preview using the existing `alfi-agents-dashboard` project and its five configured runtime variables.
- [ ] Verify the official logo, English/LTR content, Alphi colors, login screen, fleet shell, and agent workspace at desktop and mobile widths.
- [ ] Promote the verified result to production.
