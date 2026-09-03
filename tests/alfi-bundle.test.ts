import { describe, expect, test } from "vitest";
import { ALFI_BUNDLE, ALFI_DEFAULT_CRON_JOBS } from "../src/generated/alfi-bundle";

describe("generated Alfi bundle", () => {
  test("includes identity, configuration, skills, and cron defaults", () => {
    const paths = ALFI_BUNDLE.map((file) => file.path);

    expect(paths).toContain("SOUL.md");
    expect(paths).toContain("config/mcp.yaml");
    expect(paths).toContain("config/ENVIRONMENT.md");
    expect(ALFI_DEFAULT_CRON_JOBS.map((job) => job.key)).toEqual([
      "alfi:evening-pipeline-audit",
      "alfi:morning-sales-review",
    ]);
  });

  test("sorts files and cron defaults deterministically", () => {
    const paths = ALFI_BUNDLE.map((file) => file.path);
    const keys = ALFI_DEFAULT_CRON_JOBS.map((job) => job.key);

    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });

  test("references only installed skills", () => {
    const installed = new Set(ALFI_BUNDLE.map((file) => file.path));

    for (const job of ALFI_DEFAULT_CRON_JOBS) {
      expect(job.timezone).toBe("Asia/Jerusalem");
      for (const skill of job.skills) {
        expect(installed.has(`skills/${skill}/SKILL.md`), `${job.key}: ${skill}`).toBe(true);
      }
    }
  });
});
