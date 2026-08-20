import { requireMinionsAccess } from "@/lib/minions/access";
import { minionsFetch } from "@/lib/minions/client";
import { ApiError, handleError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; path?: string[] }> };
type Access = "member" | "admin";

const METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);

function isIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && !/[\\/%]/.test(value) && value !== "." && value !== "..";
}

// Keep this grammar explicit. It is both the port-6969 exposure boundary and a convenient place
// to make new Minions endpoints an intentional product decision.
export function isAllowedMinionsRoute(method: string, path: string[]): Access | null {
  if (!METHODS.has(method) || path.length === 0 || path.some((segment) => !isIdentifier(segment))) return null;

  const [root, id, action, extra, fifth] = path;
  if (root === "events") return method === "GET" && path.length === 1 ? "member" : null;

  if (root === "tasks") {
    if (path.length === 1 && (method === "GET" || method === "POST")) return method === "GET" ? "member" : "admin";
    if (path.length === 2 && isIdentifier(id) && ["GET", "PATCH", "DELETE"].includes(method)) {
      return method === "GET" ? "member" : "admin";
    }
    if (path.length === 3 && isIdentifier(id) && action === "move" && method === "POST") return "admin";
    return null;
  }

  if (root === "skills") {
    if (path.length === 1 && method === "GET") return "member";
    if (path.length === 2 && (id === "install" || id === "import") && method === "POST") return "admin";
    if (path.length === 2 && isIdentifier(id) && method === "DELETE") return "admin";
    if (path.length === 3 && isIdentifier(id) && action === "content" && method === "GET") return "member";
    if (path.length === 3 && id === "registry" && ["search", "browse"].includes(action ?? "") && method === "GET") return "member";
    if (path.length === 4 && id === "registry" && isIdentifier(action) && ["content", "scan"].includes(extra ?? "") && method === "GET") return "member";
    return null;
  }

  if (root === "scheduled-tasks") {
    if (path.length === 1 && (method === "GET" || method === "POST")) return method === "GET" ? "member" : "admin";
    if (path.length === 2 && isIdentifier(id) && ["GET", "PATCH", "DELETE"].includes(method)) {
      return method === "GET" ? "member" : "admin";
    }
    if (path.length === 3 && isIdentifier(id) && ["pause", "resume", "run"].includes(action ?? "") && method === "POST") return "admin";
    if (path.length === 3 && isIdentifier(id) && action === "runs" && method === "GET") return "member";
    if (path.length === 5 && isIdentifier(id) && action === "runs" && isIdentifier(extra) && fifth === "content" && method === "GET") return "member";
    return null;
  }

  return null;
}

async function forward(request: Request, ctx: Ctx) {
  const { id, path = [] } = await ctx.params;
  const access = isAllowedMinionsRoute(request.method, path);
  if (!access) throw new ApiError(404, "not_found", "Minions route not found");

  await requireMinionsAccess(id, access);
  const contentType = request.headers.get("content-type");
  const body = request.method === "GET" ? undefined : await request.arrayBuffer();
  const query = new URL(request.url).search;
  // minionsFetch, never the browser request, injects X-Agent37-Key.
  const upstream = await minionsFetch(id, `${path.map(encodeURIComponent).join("/")}${query}`, {
    method: request.method,
    headers: contentType ? { "Content-Type": contentType } : undefined,
    body: body && body.byteLength > 0 ? body : undefined,
  });

  const upstreamContentType = upstream.headers.get("content-type") ?? "application/json; charset=utf-8";
  const headers = new Headers({ "Content-Type": upstreamContentType });
  if (upstreamContentType.includes("text/event-stream")) {
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("X-Accel-Buffering", "no");
    headers.set("Connection", "keep-alive");
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    return await forward(request, ctx);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    return await forward(request, ctx);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    return await forward(request, ctx);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    return await forward(request, ctx);
  } catch (error) {
    return handleError(error);
  }
}

export const maxDuration = 300;
