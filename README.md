# Alfi

Alfi is a bilingual business assistant for owners. Customers talk to Alfi, manage schedules and results, connect business tools, and use two WhatsApp paths: their business number through Kapso, and a private owner channel on the shared Meta Cloud number.

This repository is the canonical Alfi product. It is a client of the [Agent37](https://www.agent37.com) API. Only Kapso business numbers and the shared Meta Cloud owner channel are supported.

## Customer experience

- **Alfi** — the conversation
- **Schedules** — live Hermes jobs and results, timezone `Asia/Jerusalem`
- **WhatsApp** — connect business WhatsApp, and talk to Alfi on WhatsApp
- **Business** — integrations Alfi can read

Staff see an additional **Advanced** area. Staff access is server-enforced.

## Setup

Follow **SETUP.md**. You will need `AGENT37_API_KEY` (funded Agent37 wallet) and `SUPABASE_ACCESS_TOKEN`. `npm run setup` configures Supabase. Never print or commit the `sk_live_` key.

Then fill the WhatsApp and staff values in `.env.local` from `.env.example`.

```bash
npm install
npm run setup
npm run dev
```

## Commands

```bash
npm run dev
npm test
npm run typecheck
npm run verify   # generate bundle, tests, typecheck, production build
```

## Operations

See `docs/operations/production.md` for environment variables, webhooks, staff roles, cron checks, Vercel, and rollback.
