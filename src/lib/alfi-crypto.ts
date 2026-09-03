import { createHmac, timingSafeEqual } from "node:crypto";

export function hashTokenWithPepper(token: string, pepper: string): string {
  return createHmac("sha256", pepper).update(token).digest("hex");
}

export function verifyWebhookHmac(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
