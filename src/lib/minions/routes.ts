export type MinionsAccess = "member" | "admin";

const METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);

export function isIdentifier(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && !/[\\/%]/.test(value) && value !== "." && value !== "..";
}

// This grammar is the public exposure boundary for Minions. New upstream endpoints must be added
// here deliberately, with the least privilege required by their operation.
export function isAllowedMinionsRoute(method: string, path: string[]): MinionsAccess | null {
  if (!METHODS.has(method) || path.length === 0 || path.some((segment) => !isIdentifier(segment))) return null;

  const [root, id, action, extra, fifth] = path;
  if (root === "events") return method === "GET" && path.length === 1 ? "member" : null;

  if (root === "tasks") {
    if (path.length === 1 && (method === "GET" || method === "POST")) return method === "GET" ? "member" : "admin";
    if (path.length === 2 && isIdentifier(id) && ["GET", "PATCH", "DELETE"].includes(method)) return method === "GET" ? "member" : "admin";
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
    if (path.length === 2 && isIdentifier(id) && ["GET", "PATCH", "DELETE"].includes(method)) return method === "GET" ? "member" : "admin";
    if (path.length === 3 && isIdentifier(id) && ["pause", "resume", "run"].includes(action ?? "") && method === "POST") return "admin";
    if (path.length === 3 && isIdentifier(id) && action === "runs" && method === "GET") return "member";
    if (path.length === 5 && isIdentifier(id) && action === "runs" && isIdentifier(extra) && fifth === "content" && method === "GET") return "member";
  }

  return null;
}
