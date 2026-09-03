# Alfi release evidence

**Date:** 2026-09-03  
**Branch:** `cursor/alfi-whatsapp-provisioning-b3a3`  
**Canonical repo:** `starter-kit-pr3`  
**Tip commit at recording:** `2417b05` (`docs: establish canonical Alfi product`)

## Automated

| Gate | Result |
|---|---|
| `npm run generate:alfi` twice | 14 files, 2 cron defaults, no generated drift |
| `npm test` | 15 files, 47 tests passed |
| `npm run typecheck` | passed |
| `npm run verify` | passed (generate + tests + typecheck + `next build`) |

## Browser and runtime

Local `npm run dev` / `npm run start` could not be exercised: this checkout has no `.env.local`. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, so `src/lib/supabase/middleware.ts` throws before `/login` can render.

The following were therefore **not** opened in a browser on this machine:

- English desktop / Hebrew RTL mobile
- schedule CRUD, run-now, results, Continue with Alfi
- WhatsApp two-card setup
- Business connections
- staff `/advanced` vs customer 404/403
- live Agent37 `hermes cron` on a real instance

## External blockers

- No local Supabase, Agent37, Kapso, or Meta secrets
- GitHub CLI was previously unauthenticated
- Vercel CLI was previously unavailable
- `NEXT_PUBLIC_ALFI_WHATSAPP_NUMBER` and `ALFI_STAFF_EMAILS` are not set in this environment
- Production URL https://alfi-agents-dashboard.vercel.app still serves the previous product until this branch is deployed

Do not treat that production URL as the finished release until it is redeployed from this branch and the customer/staff smoke flows above are repeated there.
