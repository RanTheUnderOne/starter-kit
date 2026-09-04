export function kapsoDeletedPatch() {
  return {
    status: "revoked" as const,
    enabled: false,
    phone_number_id: null,
    business_account_id: null,
    display_phone_number: null,
    connected_at: null,
    trigger_active: false,
    kapso_setup_link_id: null,
    setup_expires_at: null,
    updated_at: new Date().toISOString(),
  };
}

export function canReuseSetupLink(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return false;
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires > now + 60_000;
}

export function isUnsupportedPublicPortError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  return /unsupported[_ -]?public[_ -]?port/i.test(`${code} ${message}`);
}

export function createdAlfiHttpStatus(provisioningOk: boolean) {
  return provisioningOk ? 201 : 503;
}

export async function createAgentWithProvisionFailure() {
  return { status: createdAlfiHttpStatus(false) };
}
