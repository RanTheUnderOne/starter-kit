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

function connectionLabel(status?: string | null) {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "failed":
      return "Couldn’t connect";
    case "revoked":
      return "Disconnected";
    default:
      return "Not connected";
  }
}

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
        // Setup may still be waiting; keep the current state.
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

  async function retrySetup() {
    setBusy(true);
    try {
      await apiFetch(`/api/agents/${agentId}/provision`, { method: "POST" });
      toast.success("Alfi is ready");
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    await apiFetch(`/api/agents/${agentId}/whatsapp/revoke`, { method: "POST" });
    toast.success("WhatsApp disconnected");
    await load();
  }

  async function saveNumber() {
    setBusy(true);
    try {
      await apiFetch(`/api/agents/${agentId}/whatsapp/allowlist`, {
        method: "POST",
        body: JSON.stringify({ phone: ownerPhone }),
      });
      toast.success("WhatsApp number saved");
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
      <section className="rounded-xl border p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Chat with Alfi on WhatsApp</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Enter the WhatsApp number you use. Only this number can message this Alfi.
              </p>
            </div>
          </div>
          <Badge variant={connection?.owner_phone_e164 ? "success" : "warning"}>
            {connection?.owner_phone_e164 ? "Saved" : "Not set"}
          </Badge>
        </div>

        {role === "admin" && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="shared-owner-phone">Your WhatsApp number</Label>
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
              <Button size="sm" onClick={saveNumber} disabled={busy || !ownerPhone.trim()}>
                {busy ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Customer WhatsApp</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Connect your business WhatsApp so Alfi can help with customer chats.
              </p>
            </div>
          </div>
          <Badge variant={badge}>{connectionLabel(connection?.status)}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {connected && (
            <p className="text-sm font-medium">
              {connection.display_phone_number || "Connected"}
            </p>
          )}
          {connection?.provisioning_status === "failed" && (
            <p className="text-sm text-destructive">
              Alfi couldn’t finish setup. Try again before using WhatsApp.
            </p>
          )}
          {role === "admin" && (
            <div className="flex flex-wrap gap-2">
              {!connected && (
                <Button size="sm" onClick={connect} disabled={busy}>
                  {connection?.status === "connecting"
                    ? "Continue setup"
                    : connection?.status === "revoked"
                      ? "Reconnect WhatsApp"
                      : "Connect WhatsApp"}
                </Button>
              )}
              {connection?.provisioning_status === "failed" && (
                <Button size="sm" variant="outline" onClick={retrySetup} disabled={busy}>
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Button>
              )}
              {connected && (
                <Button size="sm" variant="outline" onClick={() => setConfirmRevoke(true)}>
                  Disconnect
                </Button>
              )}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={confirmRevoke}
          onOpenChange={setConfirmRevoke}
          title="Disconnect WhatsApp?"
          description="Alfi will stop helping with this business number. You can connect it again later."
          confirmText="Disconnect"
          destructive
          onConfirm={revoke}
        />
      </section>
    </div>
  );
}
