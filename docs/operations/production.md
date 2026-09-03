# Alfi production operations

## Environment

Copy `.env.example` to `.env.local` (or Vercel project env). Never commit secrets.

| Name | Where |
|---|---|
| `AGENT37_API_KEY` | Server only. Agent37 Cloud API keys. Fund the wallet. |
| `KAPSO_API_KEY` | Server only. Kapso project key. |
| `KAPSO_PROJECT_WEBHOOK_SECRET` | Server only. Kapso webhook signature. |
| `ALFI_MCP_TOKEN_PEPPER` | Server only. 32+ random bytes. |
| `ALFI_PUBLIC_URL` | Public origin of this app. |
| `META_APP_SECRET` | Server only. Meta app secret. |
| `META_VERIFY_TOKEN` | Server only. Meta verify token. |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | Server only. Shared Alfi Cloud number. |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | Server only. |
| `NEXT_PUBLIC_ALFI_WHATSAPP_NUMBER` | Public digits for the `wa.me` owner-channel link. |
| `ALFI_STAFF_EMAILS` | Server only. Comma-separated staff emails. |
| `NEXT_PUBLIC_SUPABASE_URL` | From `npm run setup`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From `npm run setup`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. From `npm run setup`. |
| `NEXT_PUBLIC_SITE_URL` | Production URL for auth redirects. |

All four Meta values are required before owner-channel routing is reported ready.

## Migrations

Run the SQL in `supabase/migrations/` in order, starting with `0001_init.sql`. `npm run setup` applies them on a new project.

## Webhooks

- **Meta Cloud** callback URL: `https://<ALFI_PUBLIC_URL>/api/webhooks/whatsapp`
- **Kapso** project webhook: `https://<ALFI_PUBLIC_URL>/api/webhooks/kapso`

## Staff

Grant staff with verified Supabase `app_metadata.alfi_role = staff`, an exact email in `src/config/staff.ts`, or `ALFI_STAFF_EMAILS`. Workspace admin is not staff.

## Cron

New Alfi instances install default jobs `alfi:morning-sales-review` and `alfi:evening-pipeline-audit` at `Asia/Jerusalem`. After provisioning, confirm with `hermes cron list`, `hermes cron doctor`, and `hermes cron status` on a test instance.

## Vercel

1. Set every server env var on the project. Do not expose `AGENT37_API_KEY` or service-role keys to the browser.
2. Deploy the canonical branch.
3. Confirm `/login` loads and unauthenticated `/dashboard` redirects to login.
4. Rollback by redeploying the previous successful production deployment.

## Secrets

Do not print, commit, or return secrets to the browser. Rotate any key that appears in logs or a client bundle.
