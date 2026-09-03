import type { AlfiDefaultCronJob } from "@/generated/alfi-bundle";
import type { CronJob } from "@/lib/types";

export type ProvisioningStep = {
  kind:
    | "upload-bundle"
    | "configure"
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
    { kind: "verify-skills" },
    { kind: "install-crons" },
    { kind: "verify-crons" },
    { kind: "cron-doctor" },
    { kind: "health" },
  ];
}

export function buildCronInstallSteps(
  existing: readonly CronJob[],
  defaults: readonly AlfiDefaultCronJob[],
): AlfiDefaultCronJob[] {
  const existingNames = new Set(existing.map((job) => job.name));
  return defaults.filter((job) => !existingNames.has(job.key));
}
