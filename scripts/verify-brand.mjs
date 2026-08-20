import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brandingPath = resolve(root, "src/config/branding.ts");
const globalsPath = resolve(root, "src/app/globals.css");
const logoPath = resolve(root, "public/alphi-logo.jpg");
const agentWorkspacePath = resolve(root, "src/components/AgentWorkspace.tsx");
const loginPath = resolve(root, "src/app/login/page.tsx");
const branding = readFileSync(brandingPath, "utf8");
const globals = readFileSync(globalsPath, "utf8");
const failures = [];
const brandSurfaces = [
  "src/components/DashboardShell.tsx",
  "src/components/AgentWorkspace.tsx",
  "src/app/login/page.tsx",
  "src/app/reset-password/page.tsx",
  "src/app/invite/[token]/page.tsx",
  "src/components/AcceptInvite.tsx",
];

if (!/appName:\s*["']Alphi Business Agent["']/.test(branding)) {
  failures.push('branding.appName must be "Alphi Business Agent"');
}
if (!/logoUrl:\s*["']\/alphi-logo\.jpg["']/.test(branding)) {
  failures.push('branding.logoUrl must be "/alphi-logo.jpg"');
}
if (!existsSync(logoPath)) {
  failures.push("public/alphi-logo.jpg is missing");
}
if (existsSync(logoPath)) {
  const logoHash = createHash("sha256").update(readFileSync(logoPath)).digest("hex");
  if (logoHash !== "9ad464f2a45a667c31e0cbef23d9b85c9741d0f2b17c74ea52174840b4a2ca08") {
    failures.push("public/alphi-logo.jpg does not match the official Alphi logo");
  }
}
for (const token of [
  "--background: #fbfbfc",
  "--foreground: #111315",
  "--card: #ffffff",
  "--primary: #2c6b5c",
  "--secondary: #efe7de",
  "--accent: #d9fdd3",
  "--border: #e5e3df",
  "--input: #d9ddd9",
  "--destructive: #b42318",
]) {
  if (!globals.includes(token)) failures.push(`globals.css is missing ${token}`);
}
for (const surface of brandSurfaces) {
  const source = readFileSync(resolve(root, surface), "utf8");
  if (!/<img\s+src=\{branding\.logoUrl\}\s+alt="Alphi"/.test(source)) {
    failures.push(`${surface} must render branding.logoUrl with alt="Alphi"`);
  }
}
const agentWorkspace = readFileSync(agentWorkspacePath, "utf8");
for (const className of ["rounded-2xl bg-secondary/70", "h-9 w-auto object-contain", "bg-primary text-primary-foreground shadow-sm"]) {
  if (!agentWorkspace.includes(className)) {
    failures.push(`src/components/AgentWorkspace.tsx is missing ${className}`);
  }
}
const login = readFileSync(loginPath, "utf8");
if (!login.includes('className="mx-auto h-24 w-24 object-contain"')) {
  failures.push("src/app/login/page.tsx must give the Alphi logo a prominent h-24 display");
}

if (failures.length > 0) {
  console.error("Brand verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Brand verification passed.");
}
