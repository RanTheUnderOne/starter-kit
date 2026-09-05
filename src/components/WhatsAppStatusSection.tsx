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

function connectionLabel(status: WhatsAppCustomerStatus["business"]["status"], he: boolean) {
  if (status === "connected") return he ? "מחובר" : "Connected";
  if (status === "connecting") return he ? "בתהליך חיבור" : "Connecting";
  if (status === "failed" || status === "revoked") return he ? "החיבור נותק" : "Disconnected";
  return he ? "עדיין לא מחובר" : "Not connected";
}

export function WhatsAppStatusSection({
  agentId,
  role,
}: {
  agentId: string;
  role: Role;
}) {
  const { t, locale } = useLocale();
  const he = locale === "he";
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
      toast.error(t("common.error"));
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
      toast.error(t("common.error"));
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
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const business = status?.business;
  const owner = status?.ownerChannel;
  const url = alfiWhatsAppTalkUrl(configuredAlfiWhatsAppDigits(), t("chat.whatsappGreeting"));

  return (
    <div className="alfi-channels grid gap-5 lg:grid-cols-2">
      <section className="alfi-channel alfi-surface p-5 sm:p-7">
        <div className="flex flex-col-reverse items-start gap-5">
          <div className="flex flex-col items-start gap-4">
            <span className="alfi-channel-icon">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{he ? "המספר של העסק" : "Your business number"}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{he ? "חבר את המספר שאליו הלקוחות שלך פונים, כדי ש-Alfi יוכל לעבוד עם הפניות של העסק." : "Connect the number your customers use so Alfi can work with your business inquiries."}</p>
            </div>
          </div>
          <Badge variant={business?.connected ? "success" : "warning"}>
            {business ? connectionLabel(business.status, he) : t("common.loading")}
          </Badge>
        </div>
        {business?.connected && business.displayNumber && (
          <p className="mt-4 text-sm font-medium text-foreground">{business.displayNumber}</p>
        )}
        {role === "admin" && (
          <div className="mt-5 flex flex-wrap gap-2">
            {business?.canSetup && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={connect} disabled={busy}>
                {t("whatsappBusinessTitle")}
              </Button>
            )}
            {business?.connected && (
              <Button variant="outline" className="rounded-full" onClick={() => setConfirmRevoke(true)}>
                {he ? "ניתוק המספר העסקי" : "Disconnect business number"}
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="alfi-channel alfi-surface p-5 sm:p-7">
        <div className="flex flex-col-reverse items-start gap-5">
          <div className="flex flex-col items-start gap-4">
            <span className="alfi-channel-icon">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{he ? "הקו הפרטי שלך עם Alfi" : "Your private line to Alfi"}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{he ? "דבר עם Alfi מהטלפון שלך. המספר האישי מזהה אותך כבעל העסק ונפרד מערוץ הלקוחות." : "Talk to Alfi from your phone. Your personal number identifies you as the owner, separately from the customer channel."}</p>
            </div>
          </div>
          <Badge variant={owner?.ready ? "success" : "warning"}>{!status ? t("common.loading") : owner?.ready ? (he ? "אפשר לדבר" : "Ready to talk") : (he ? "נדרשת הגדרה" : "Setup needed")}</Badge>
        </div>
        {role === "admin" && (
          <div className="mt-5 space-y-2">
            <Label htmlFor="shared-owner-phone">{t("whatsappOwnerNumber")}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="shared-owner-phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder="972501234567"
                value={ownerPhone}
                onChange={(event) => setOwnerPhone(event.target.value)}
                disabled={busy}
              />
              <Button className="rounded-full" onClick={saveNumber} disabled={busy || !ownerPhone.trim()}>
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
            className="mt-5 inline-flex h-11 items-center rounded-full bg-teal-900 px-5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            {t("whatsappOpen")}
          </a>
        )}
        {isStaff && status && !owner?.ready && (
          <p className="mt-4 text-xs text-foreground/45">Owner routing is not confirmed ready.</p>
        )}
      </section>

      <ConfirmDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title={he ? "לנתק את המספר העסקי?" : "Disconnect your business number?"}
        description={he ? "החיבור של Alfi לוואטסאפ העסקי יופסק. ניתן לחבר אותו שוב בהמשך." : "Alfi will be disconnected from your business WhatsApp. You can reconnect later."}
        confirmText={he ? "ניתוק" : "Disconnect"}
        destructive
        onConfirm={revoke}
      />
    </div>
  );
}
