"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { Role, WhatsAppCustomerStatus } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { alfiWhatsAppTalkUrl, configuredAlfiWhatsAppDigits } from "@/lib/alfi-whatsapp-link";

function connectionLabel(status: WhatsAppCustomerStatus["business"]["status"]) {
  if (status === "connected") return "Connected";
  if (status === "connecting") return "Connecting";
  if (status === "failed" || status === "revoked") return "Disconnected";
  return "Not connected";
}

export function WhatsAppStatusSection({
  agentId,
  role,
}: {
  agentId: string;
  role: Role;
}) {
  const { t } = useLocale();
  const { isStaff } = useWorkspace();
  const [status, setStatus] = useState<WhatsAppCustomerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState("");
  const load = useCallback(async () => {
    try {
      const next = await apiFetch<WhatsAppCustomerStatus>(`/api/agents/${agentId}/whatsapp/status`);
      setStatus(next);
      setOwnerPhone(next.ownerChannel.ownerPhone ?? "");
    } catch (error) {
      toast.error((error as Error).message || t("common.error"));
    }
  }, [agentId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status?.business.status !== "connecting") return;
    const timer = setInterval(async () => {
      try {
        await apiFetch(`/api/agents/${agentId}/whatsapp/reconcile`, { method: "POST" });
        await load();
      } catch {
        // Setup may still be waiting.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [agentId, status?.business.status, load]);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>(`/api/agents/${agentId}/whatsapp/setup`, { method: "POST" });
      window.location.assign(url);
    } catch (error) {
      toast.error((error as Error).message || t("common.error"));
      setBusy(false);
    }
  }

  async function revoke() {
    await apiFetch(`/api/agents/${agentId}/whatsapp/revoke`, { method: "POST" });
    await load();
  }

  async function saveNumber() {
    setBusy(true);
    try {
      const next = await apiFetch<WhatsAppCustomerStatus>(`/api/agents/${agentId}/whatsapp/allowlist`, {
        method: "POST",
        body: JSON.stringify({ phone: ownerPhone }),
      });
      setStatus(next);
      setOwnerPhone(next.ownerChannel.ownerPhone ?? ownerPhone);
    } catch (error) {
      toast.error((error as Error).message || t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const business = status?.business;
  const owner = status?.ownerChannel;
  const url = alfiWhatsAppTalkUrl(configuredAlfiWhatsAppDigits(), t("chat.whatsappGreeting"));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("whatsappBusinessTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("whatsappBusinessBody")}</p>
            </div>
          </div>
          <Badge variant={business?.connected ? "success" : "warning"} className="rounded-full">
            {business ? connectionLabel(business.status) : t("common.loading")}
          </Badge>
        </div>
        {business?.connected && business.displayNumber && (
          <p className="mt-4 text-sm font-medium text-foreground">{business.displayNumber}</p>
        )}
        {role === "admin" && (
          <div className="mt-5 flex flex-wrap gap-2">
            {business?.canSetup && (
              <Button className="rounded-lg" onClick={connect} disabled={busy}>
                {t("whatsappBusinessTitle")}
              </Button>
            )}
            {business?.connected && (
              <Button variant="outline" className="rounded-lg text-destructive hover:text-destructive" onClick={() => setConfirmRevoke(true)}>
                {t("common.delete")}
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("whatsappOwnerTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("whatsappOwnerBody")}</p>
            </div>
          </div>
          <Badge variant={owner?.ready ? "success" : "warning"} className="rounded-full">{owner?.ready ? "Ready" : "Not ready"}</Badge>
        </div>
        {role === "admin" && (
          <div className="mt-5 space-y-2">
            <Label htmlFor="shared-owner-phone">{t("whatsappOwnerNumber")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="shared-owner-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="972501234567"
                value={ownerPhone}
                onChange={(event) => setOwnerPhone(event.target.value)}
                disabled={busy}
              />
              <Button className="rounded-lg" onClick={saveNumber} disabled={busy || !ownerPhone.trim()}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        )}
        {owner?.ready && url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t("whatsappOpen")}
          </a>
        )}
        {isStaff && status && !owner?.ready && (
          <p className="mt-4 text-xs text-muted-foreground">Owner routing is not confirmed ready.</p>
        )}
      </section>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title={t("whatsappBusinessTitle")}
        description={t("whatsappBusinessBody")}
        confirmText={t("common.delete")}
        destructive
        onConfirm={revoke}
      />
    </div>
  );
}
