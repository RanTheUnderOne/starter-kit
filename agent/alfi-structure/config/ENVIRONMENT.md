# Environment Variables — Alfi Master Agent

Secrets live here (`.env` / platform env), never in `mcp.yaml`.
Set these before starting Alfi.

| Variable | Required | Purpose |
|---|---|---|
| `ALFI_WHATSAPP_MCP_URL` | ✅ | Streamable HTTP endpoint hosted by the Alfi website. Injected when the Agent37 instance is created. |
| `ALFI_WHATSAPP_MCP_TOKEN` | ✅ | Unique tenant token for this instance. Injected at creation; never copy it into configuration files. |
| `AGENT37_MANAGED_TOKEN` | ✅ (on Agent37) | Rotating per-instance token. Injected automatically by the Agent37 platform — do not hardcode. |
| `AGENT37_COMPOSIO_MCP_URL` | ✅ (on Agent37) | Managed Composio MCP endpoint. Injected automatically by the Agent37 platform. |

## Notes

- **Alfi WhatsApp MCP** (`${ALFI_WHATSAPP_MCP_URL}`) — tenant-scoped HTTP tooling. Its bearer token is resolved from `${ALFI_WHATSAPP_MCP_TOKEN}` at connection time.
- **Composio MCP** (`${AGENT37_COMPOSIO_MCP_URL}`) — powers Fireberry (CRM), Gmail, and the rest of the app catalog. When Alfi runs on Agent37 this is auto-provisioned; when self-hosting, replace it with your own Composio endpoint + key.
- **Never commit real values.** Keep this file as the single source of truth for which variables are required; actual secrets go into the platform/`.env`, which is git-ignored.
