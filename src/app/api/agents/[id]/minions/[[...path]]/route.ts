import { requireMinionsAccess } from "@/lib/minions/access";
import { minionsFetch } from "@/lib/minions/client";
import { isAllowedMinionsRoute } from "@/lib/minions/routes";
import { ApiError, handleError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; path?: string[] }> };

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
