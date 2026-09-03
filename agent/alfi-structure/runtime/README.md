# Runtime installation

This repository is Alfi's source bundle. Hermes does not automatically load
skills from a Git repository.

## Install the skill bundle

Copy the contents of `alphi-structure/skills/` into the target Hermes skill
root. Preserve category and skill directories:

```text
alphi-structure/skills/sources/whatsapp/SKILL.md
→
<hermes-skill-root>/sources/whatsapp/SKILL.md
```

Repeat for every directory beneath `alphi-structure/skills/`.

Alternatively, register `alphi-structure/skills/` as an external Hermes skill
directory. The runtime configuration owns that registration; this repository
does not assume a machine-specific path.

## Install identity and configuration

- Copy `SOUL.md` to the target agent root.
- Supply MCP configuration from `config/mcp.yaml` through the runtime's native
  configuration mechanism.
- Set the variables documented in `config/ENVIRONMENT.md` in the runtime
  secret store. Never copy secret values into this repository.

## Verify after installation

1. Start a new Hermes session so its skill index is rebuilt.
2. Confirm every Alfi skill appears in `skills_list`.
3. Confirm each skill can be opened through `skill_view` or its slash command.
4. Run read-only source checks before enabling any CRM mutation policy.
