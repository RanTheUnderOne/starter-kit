import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  dashboard: readFileSync(resolve(root, "src/components/DashboardShell.tsx"), "utf8"),
  workspace: readFileSync(resolve(root, "src/components/AgentWorkspace.tsx"), "utf8"),
};
const failures = [];

function requireTokens(file, tokens) {
  for (const token of tokens) {
    if (!files[file].includes(token)) failures.push(`${file} is missing ${token}`);
  }
}

requireTokens("dashboard", [
  "md:hidden",
  'aria-label="Open navigation menu"',
  "fixed inset-y-0 left-0",
  "-translate-x-full md:static md:translate-x-0",
  "aria-label=\"Close navigation menu\"",
  "onClick={() => setMenuOpen(false)}",
  "useEffect(() => {\n    setMenuOpen(false);\n  }, [pathname]);",
  'window.matchMedia("(min-width: 768px)")',
  "inert={!isDesktop && !menuOpen}",
  "aria-hidden={!isDesktop && !menuOpen}",
]);
requireTokens("workspace", [
  "md:hidden",
  'aria-label="Open agent menu"',
  "fixed inset-y-0 left-0",
  "-translate-x-full md:static md:translate-x-0",
  "aria-label=\"Close agent menu\"",
  "touch-manipulation",
  "onClick={() => selectTab(t.id)}",
  'window.matchMedia("(min-width: 768px)")',
  "inert={!isDesktop && !menuOpen}",
  "aria-hidden={!isDesktop && !menuOpen}",
]);

if (failures.length > 0) {
  console.error("Mobile verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Mobile verification passed.");
}
