# Alphi Minions Integration Design

## Goal

Extend the existing Alphi Business Agent dashboard with first-class task, skill, and schedule management for a new class of agents, without changing existing agents or creating a second user-facing site.

## Approved direction

Alphi will add an **Alphi Task Agent** type. Creating this type provisions a new Agent37 instance from the **Alfi Agent** workspace template, which bundles Hermes and Minions. Existing agents keep their current Hermes template, tabs, behavior, and deployment unchanged.

The existing Alphi dashboard will render the new capabilities natively. It will not embed or publicly expose the Minions UI.

## Runtime architecture

Each Alphi Task Agent runs Hermes and Minions in the same Agent37 instance:

```text
Alphi browser
  -> Alphi Next.js BFF (Supabase user and agent-ownership authorization)
    -> https://{instanceId}-6969.agent37.app (X-Agent37-Key, server-side only)
      -> Minions Express API
        -> Hermes Python runtime and persistent instance volume
```

Minions listens on port `6969`. Agent37 derives a preview URL for that port. The Alphi BFF calls it with `X-Agent37-Key`; neither that key nor a signed URL is sent to the browser.

The custom image must preserve Hermes as an operational service while also starting Minions. It installs Minions binaries outside `/home/node`; Minions runtime state persists at `~/.minions/`.

## Product behavior

### Agent creation

- The creation UI offers `Alphi Task Agent` in addition to existing agent types.
- The type points to the version-pinned workspace template `alfi-agent@1` when that template is published.
- The normal ownership mirror, default shape, budget handling, and lifecycle behavior continue to use the existing Alphi creation path.
- Creation errors clearly distinguish an unavailable template from ordinary Agent37 errors.

### Workspace tabs

For an Alphi Task Agent, the per-agent workspace adds:

- **Tasks** — list, create, update, and supervise Minions tasks, including live task activity where Minions exposes it.
- **Skills** — browse installed skills, inspect content, install from the approved registry, import allowed packages, and delete skills.
- **Schedules** — list, create, edit, pause, resume, run, delete, and inspect output for Minions scheduled tasks.

Existing agents continue to show exactly Chat, Files, Integrations, and Settings. A direct URL for a Minions-only tab on an existing agent returns the normal not-found behavior rather than rendering an unusable screen.

### Skills and Hermes

When a user installs or imports a skill through the Alphi Skills tab, Alphi forwards the authorized request to that agent's Minions service. Minions stores skills in `~/.minions/skills` and updates the same instance's `~/.hermes/config.yaml` so the directory appears in Hermes `external_dirs`. Hermes subsequently loads the skills. Alphi does not edit Hermes configuration itself.

### Schedules and Hermes

The Alphi Schedules tab forwards authorized operations to Minions. Minions' Python worker calls the local Hermes runtime to manage the underlying scheduled tasks; Alphi does not call the Hermes Dashboard API on port `9119` for these agents.

## Security and isolation

- The browser only calls Alphi's same-origin `/api/agents/{id}/minions/**` routes.
- Each route must require an authenticated user and verify workspace membership plus ownership of the target agent before calling Agent37.
- The Agent37 API key remains server-only and is sent only to the Agent37 edge in `X-Agent37-Key`.
- Port `6969` is not made public. The application does not use an iframe or a browser-visible signed URL for built-in Minions capabilities.
- Alphi treats Minions responses as untrusted upstream data and maps errors to the existing API error conventions without leaking credentials or internal upstream URLs.

## Versioning, rollback, and deployment

- All source work happens on `feat/alphi-minions`, branching from the deployed Alphi PWA commit `69773da`.
- The custom image is managed in a separate custom-image build context/repository; its published workspace template revision is immutable.
- Initial production rollout creates only a new test Alphi Task Agent. No existing Agent37 instance is updated.
- The Alphi web deployment stays on a separate commit. Rollback is a Vercel rollback or redeploy of the previous Alphi commit; new Minions agents remain isolated and can be stopped or deleted through the normal lifecycle controls.
- `package-lock.json` remains unstaged and unmodified by this work.

## Verification

- Use deterministic automated tests and contract scripts only; do not perform visual browser testing.
- Test server routes for authorization, agent-type gating, upstream request construction, response mapping, and failed upstream responses.
- Test tab grammar and conditional navigation for new versus existing agents.
- Build the custom image through Agent37, create one isolated test instance, and verify Minions health on port `6969` with authenticated programmatic access.
- Verify a skill installation causes Minions to expose it and that a scheduled task can be created, paused, resumed, triggered, and observed through Alphi's BFF.
- Run typecheck, production build, focused contract tests, and `git diff --check` before each commit and before deployment.
