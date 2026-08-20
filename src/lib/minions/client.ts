import "server-only";

import { Agent37Error } from "@/lib/agent37";

// This is deliberately distinct from instanceFetch: Minions has no public browser URL in Alphi.
// The only caller is the same-origin API route after workspace and template capability checks.
export async function minionsFetch(id: string, path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.AGENT37_API_KEY;
  if (!key) {
    throw new Agent37Error(500, "config_error", "AGENT37_API_KEY is not set on the server");
  }

  const origin = `https://${id}-6969.agent37.app`;
  const contentType = new Headers(init.headers).get("content-type");

  return fetch(`${origin}/api/${path}`, {
    ...init,
    headers: { "X-Agent37-Key": key, ...(contentType ? { "Content-Type": contentType } : {}) },
    cache: "no-store",
  });
}
