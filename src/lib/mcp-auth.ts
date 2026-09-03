import "server-only";
import { randomBytes } from "node:crypto";
import { mcpTokenPepper } from "@/lib/alfi-config";
import { hashTokenWithPepper } from "@/lib/alfi-crypto";

export function createMcpToken(): string {
  return `alfi_mcp_${randomBytes(32).toString("base64url")}`;
}

export function hashMcpToken(token: string): string {
  return hashTokenWithPepper(token, mcpTokenPepper());
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}
