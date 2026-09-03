"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateAgentButton({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [ownerPhone, setOwnerPhone] = useState("");
  const router = useRouter();

  async function create() {
    setBusy(true);
    try {
      const agent = await apiFetch<{ id: string }>("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: workspaceId,
          owner_phone: ownerPhone.trim() || undefined,
        }),
      });
      setAgentId(agent.id);
      toast.success("Alfi is ready");
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function connectWhatsApp() {
    if (!agentId) return;
    setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>(
        `/api/agents/${agentId}/whatsapp/setup`,
        { method: "POST" }
      );
      window.location.assign(url);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  function finish() {
    if (!agentId) return;
    setAgentId(null);
    setOwnerPhone("");
    setOpen(false);
    router.push(`/dashboard/agents/${agentId}/settings`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create Alfi
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          setOpen(next);
          if (!next) {
            setAgentId(null);
            setOwnerPhone("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{agentId ? "Connect WhatsApp Business?" : "Create Alfi"}</DialogTitle>
          </DialogHeader>

          {agentId ? (
            <div className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Use your existing business number</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Keep using the WhatsApp Business app while Alfi securely reads and manages
                    conversations when you ask. You can also connect later in Settings.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We&apos;ll create your private Hermes instance, install Alfi&apos;s business
                skills, and connect its per-instance Composio tools.
              </p>
              <div className="space-y-2">
                <Label htmlFor="owner-phone">Your WhatsApp number</Label>
                <Input
                  id="owner-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+972501234567"
                  value={ownerPhone}
                  onChange={(event) => setOwnerPhone(event.target.value)}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Only this number can message this Alfi on the shared Alfi WhatsApp
                  line. You can set or change it later in Settings.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {agentId ? (
              <>
                <Button variant="outline" onClick={finish} disabled={busy}>
                  Connect later
                </Button>
                <Button onClick={connectWhatsApp} disabled={busy}>
                  {busy ? "Opening..." : "Connect WhatsApp"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={create} disabled={busy}>
                  {busy ? "Installing Alfi..." : "Create Alfi"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
