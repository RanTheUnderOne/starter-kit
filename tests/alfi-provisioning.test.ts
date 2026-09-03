import { describe, expect, test } from "vitest";
import { ALFI_DEFAULT_CRON_JOBS } from "../src/generated/alfi-bundle";
import {
  buildCronInstallSteps,
  buildProvisioningSteps,
  disabledSkillNames,
  parseHermesSkillListNames,
} from "../src/lib/alfi-provisioning-core";

describe("Alfi provisioning contract", () => {
  test("installs schedules before reporting a healthy ready agent", () => {
    expect(buildProvisioningSteps().map((step) => step.kind)).toEqual([
      "upload-bundle",
      "configure",
      "disable-stock-skills",
      "verify-skills",
      "install-crons",
      "verify-crons",
      "cron-doctor",
      "health",
    ]);
  });

  test("installs every missing default", () => {
    expect(buildCronInstallSteps([], ALFI_DEFAULT_CRON_JOBS).map((job) => job.key)).toEqual([
      "alfi:evening-pipeline-audit",
      "alfi:morning-sales-review",
    ]);
  });

  test("does not overwrite a customer's edited live default", () => {
    const steps = buildCronInstallSteps(
      [
        {
          id: "morning",
          name: "alfi:morning-sales-review",
          displayName: "Morning sales review",
          schedule: "0 9 * * *",
          prompt: "My edited prompt",
          state: "scheduled",
          enabled: true,
          nextRunAt: null,
          lastRunAt: null,
          lastStatus: null,
          lastError: null,
          skills: [],
          managedDefault: true,
        },
      ],
      ALFI_DEFAULT_CRON_JOBS,
    );

    expect(steps).toHaveLength(1);
    expect(steps[0].key).toBe("alfi:evening-pipeline-audit");
  });

  test("disables every installed skill except Alfi creation skills", () => {
    expect(
      disabledSkillNames(
        ["pdf", "github", "lead-triage", "lead-triage", "claude-code"],
        ["lead-triage", "source-whatsapp"],
      ),
    ).toEqual(["claude-code", "github", "pdf"]);
  });

  test("parses Hermes skill table names", () => {
    const table = `
│ Name       │ Source  │
│ pdf        │ builtin │
│ lead-triage│ local   │
`;
    expect(parseHermesSkillListNames(table)).toEqual(["pdf", "lead-triage"]);
  });
});
