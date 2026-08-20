import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    failures.push(`${path} is missing`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

function requireTokens(path, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) failures.push(`${path} is missing ${token}`);
  }
}

const manifest = read("src/app/manifest.ts");
const layout = read("src/app/layout.tsx");
const registration = read("src/components/PwaRegistration.tsx");
const worker = read("public/sw.js");
const config = read("next.config.ts");
const proxy = read("src/proxy.ts");

requireTokens("src/app/manifest.ts", manifest, [
  "name: branding.appName",
  'short_name: "Alphi"',
  'id: "/"',
  'start_url: "/"',
  'display: "standalone"',
  'background_color: "#fbfbfc"',
  'theme_color: "#2c6b5c"',
  'src: "/icons/alphi-192.png"',
  'sizes: "192x192"',
  'src: "/icons/alphi-512.png"',
  'sizes: "512x512"',
]);
requireTokens("src/app/layout.tsx", layout, [
  'manifest: "/manifest.webmanifest"',
  "appleWebApp:",
  "capable: true",
  "title: branding.appName",
  'statusBarStyle: "default"',
  'apple: "/icons/alphi-180.png"',
  'themeColor: "#2c6b5c"',
  "<PwaRegistration />",
]);
requireTokens("src/components/PwaRegistration.tsx", registration, [
  '"use client"',
  '"serviceWorker" in navigator',
  'navigator.serviceWorker.register("/sw.js"',
  'scope: "/"',
  'updateViaCache: "none"',
]);
requireTokens("public/sw.js", worker, ["self.skipWaiting()", "self.clients.claim()"]);
for (const forbidden of [
  "caches.",
  "caches[",
  'addEventListener("fetch"',
  "addEventListener('fetch'",
]) {
  if (worker.includes(forbidden)) failures.push(`public/sw.js must not contain ${forbidden}`);
}
requireTokens("next.config.ts", config, [
  'source: "/sw.js"',
  'key: "Content-Type"',
  'value: "application/javascript; charset=utf-8"',
  'key: "Cache-Control"',
  'value: "no-cache, no-store, must-revalidate"',
]);
requireTokens("src/proxy.ts", proxy, [
  "manifest\\\\.webmanifest",
  "sw\\\\.js",
]);

for (const [path, expected] of [
  ["public/icons/alphi-180.png", 180],
  ["public/icons/alphi-192.png", 192],
  ["public/icons/alphi-512.png", 512],
]) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    failures.push(`${path} is missing`);
    continue;
  }
  const png = readFileSync(absolute);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== expected || height !== expected) {
    failures.push(`${path} must be ${expected}x${expected}; found ${width}x${height}`);
  }
}

if (failures.length > 0) {
  console.error("PWA verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PWA verification passed.");
}
