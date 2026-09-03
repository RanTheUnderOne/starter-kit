"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { Role, WhatsAppConnectionPublic } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WhatsAppStatusSection({
  agentId,
  role,
}: {
  agentId: string;
  role: Role;
}) {
  const [connection, setConnection] = useState<WhatsAppConnectionPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState("");
  const load = useCallback(async () => {
    try {
      const next = await apiFetch<WhatsAppConnectionPublic>(`/api/agents/${agentId}/whatsapp/status`);
      setConnection(next);
      setOwnerPhone(next.owner_phone_e164 ?? "");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (connection?.status !== "connecting") return;
    const timer = setInterval(async () => {
      try {
        await apiFetch(`/api/agents/${agentId}/whatsapp/reconcile`, { method: "POST" });
        await load();
      } catch {
        // Setup may still be waiting for Meta; keep the current state.
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [agentId, connection?.status, load]);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>(
        `/api/agents/${agentId}/whatsapp/setup`,
        { method: "POST" }
      );
      window.location.assign(url);
    } catch (error) {
      toast.error((error as Error).message);
      setBusy(false);
    }
  }

  async function retryProvisioning() {
    setBusy(true);
    try {
      await apiFetch(`/api/agents/${agentId}/provision`, { method: "POST" });
      toast.success("Alfi provisioning completed");
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    await apiFetch(`/api/agents/${agentId}/whatsapp/revoke`, { method: "POST" });
    toast.success("WhatsApp access revoked");
    await load();
  }

  async function saveAllowlist() {
    setBusy(true);
    try {
      await apiFetch(`/api/agents/${agentId}/whatsapp/allowlist`, {
        method: "POST",
        body: JSON.stringify({ phone: ownerPhone }),
      });
      toast.success("Shared Alfi number allowlist saved");
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const connected = connection?.status === "connected";
  const badge =
    connection?.status === "connected"
      ? "success"
      : connection?.status === "failed" || connection?.status === "revoked"
        ? "destructive"
        : "warning";

  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Shared Alfi number</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Message Alfi on the shared business line. Only this owner WhatsApp number is
                allowed to talk to this agent.
              </p>
            </div>
          </div>
          <Badge variant={connection?.owner_phone_e164 ? "success" : "warning"}>
            {connection?.owner_phone_e164 ? "allowlisted" : "not set"}
          </Badge>
        </div>

        {role === "admin" && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="shared-owner-phone">Owner WhatsApp number</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="shared-owner-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+972501234567"
                value={ownerPhone}
                onChange={(event) => setOwnerPhone(event.target.value)}
                disabled={busy}
              />
              <Button size="sm" onClick={saveAllowlist} disabled={busy || !ownerPhone.trim()}>
                {busy ? "Saving..." : "Save number"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Your WhatsApp Business</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Alfi&apos;s private, tenant-scoped access to this agent&apos;s business number.
              </p>
            </div>
          </div>
          <Badge variant={badge}>{connection?.status?.replace("_", " ") ?? "loading"}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {connected && (
            <p className="font-mono text-sm">
              {connection.display_phone_number || "Connected number"}
            </p>
          )}
          {connection?.provisioning_status === "failed" && (
            <p className="text-sm text-destructive">
              Alfi&apos;s skills could not be installed. Retry provisioning before using WhatsApp.
            </p>
          )}
          {role === "admin" && (
            <div className="flex flex-wrap gap-2">
              {!connected && (
                <Button size="sm" onClick={connect} disabled={busy}>
                  {connection?.status === "connecting"
                    ? "Resume setup"
                    : connection?.status === "revoked"
                      ? "Reconnect WhatsApp"
                      : "Connect WhatsApp"}
                </Button>
              )}
              {connection?.provisioning_status === "failed" && (
                <Button size="sm" variant="outline" onClick={retryProvisioning} disabled={busy}>
                  <RefreshCw className="h-4 w-4" />
                  Retry provisioning
                </Button>
              )}
              {connected && (
                <Button size="sm" variant="outline" onClick={() => setConfirmRevoke(true)}>
                  Revoke access
                </Button>
              )}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={confirmRevoke}
          onOpenChange={setConfirmRevoke}
          title="Revoke WhatsApp access?"
          description="Alfi will immediately lose access to this number. You can reconnect later."
          confirmText="Revoke access"
          destructive
          onConfirm={revoke}
        />
      </section>
    </div>
  );
}
