import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brandingPath = resolve(root, "src/config/branding.ts");
const globalsPath = resolve(root, "src/app/globals.css");
const logoPath = resolve(root, "public/alphi-logo.png");
const branding = readFileSync(brandingPath, "utf8");
const globals = readFileSync(globalsPath, "utf8");
const failures = [];

if (!/appName:\s*["']Alphi Business Agent["']/.test(branding)) {
  failures.push('branding.appName must be "Alphi Business Agent"');
}
if (!/logoUrl:\s*["']\/alphi-logo\.png["']/.test(branding)) {
  failures.push('branding.logoUrl must be "/alphi-logo.png"');
}
if (!existsSync(logoPath)) {
  failures.push("public/alphi-logo.png is missing");
}
for (const token of ["--background: #fbfbfc", "--primary: #2c6b5c"]) {
  if (!globals.includes(token)) failures.push(`globals.css is missing ${token}`);
}

if (failures.length > 0) {
  console.error("Brand verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Brand verification passed.");
}
