import { normalizeOrigin } from "./site-url";

export type AlfiPublicUrlEnv = {
  ALFI_PUBLIC_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
};

function httpsOrigin(value?: string | null): string | null {
  const origin = normalizeOrigin(value);
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol === "https:") return url.origin;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return url.origin;
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveAlfiPublicOrigin(env: AlfiPublicUrlEnv = process.env): string | null {
  const deployment = httpsOrigin(env.VERCEL_BRANCH_URL) || httpsOrigin(env.VERCEL_URL);

  // Preview builds must use this deployment. Agent37 stores the MCP URL at
  // create time, and production does not yet serve the WhatsApp routes.
  if (env.VERCEL_ENV === "preview" && deployment) return deployment;

  return (
    httpsOrigin(env.ALFI_PUBLIC_URL) ||
    httpsOrigin(env.NEXT_PUBLIC_SITE_URL) ||
    httpsOrigin(env.VERCEL_PROJECT_PRODUCTION_URL) ||
    deployment ||
    (env.NODE_ENV === "development" ? httpsOrigin("http://localhost:3000") : null)
  );
}
