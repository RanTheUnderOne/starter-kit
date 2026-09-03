import type { AlfiDefaultCronJob } from "@/generated/alfi-bundle";
import type { CronJob } from "@/lib/types";

export type ProvisioningStep = {
  kind:
    | "upload-bundle"
    | "configure"
    | "disable-stock-skills"
    | "verify-skills"
    | "install-crons"
    | "verify-crons"
    | "cron-doctor"
    | "health";
};

export function buildProvisioningSteps(): ProvisioningStep[] {
  return [
    { kind: "upload-bundle" },
    { kind: "configure" },
    { kind: "disable-stock-skills" },
    { kind: "verify-skills" },
    { kind: "install-crons" },
    { kind: "verify-crons" },
    { kind: "cron-doctor" },
    { kind: "health" },
  ];
}

export function parseHermesSkillListNames(table: string): string[] {
  const names: string[] = [];
  for (const line of table.split("\n")) {
    if (!line.includes("│")) continue;
    const cols = line
      .trim()
      .replace(/^│/, "")
      .split("│")
      .map((col) => col.trim());
    const name = cols[0];
    if (!name || name === "Name" || /[━─]/.test(name)) continue;
    names.push(name);
  }
  return names;
}

export function disabledSkillNames(
  installed: readonly string[],
  keep: readonly string[],
): string[] {
  const allowed = new Set(keep);
  return [...new Set(installed.filter((name) => !allowed.has(name)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function buildCronInstallSteps(
  existing: readonly CronJob[],
  defaults: readonly AlfiDefaultCronJob[],
): AlfiDefaultCronJob[] {
  const existingNames = new Set(existing.map((job) => job.name));
  return defaults.filter((job) => !existingNames.has(job.key));
}
