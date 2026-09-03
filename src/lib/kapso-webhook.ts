import { verifyWebhookHmac } from "./alfi-crypto";

export function verifyKapsoSignature(rawBody: string, signature: string | null, secret: string) {
  return verifyWebhookHmac(rawBody, signature, secret);
}
