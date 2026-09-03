import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "..");

function collect(dir: string, files: string[]) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, files);
    else if (/\.(ts|tsx|js|mjs|md|json|example)$/.test(entry)) files.push(full);
  }
}

function repositoryText() {
  const files: string[] = [];
  collect(join(root, "src"), files);
  collect(join(root, "agent"), files);
  files.push(join(root, "README.md"), join(root, "package.json"), join(root, ".env.example"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

describe("canonical product boundary", () => {
  test("contains only the two approved WhatsApp tracks", () => {
    const text = repositoryText();
    expect(text).not.toMatch(/wassenger/i);
    expect(text).toMatch(/Kapso/);
    expect(text).toMatch(/Meta Cloud/);
  });
});
