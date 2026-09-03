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
  DialogDescription,
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{agentId ? "Add WhatsApp?" : "Create Alfi"}</DialogTitle>
            <DialogDescription>
              {agentId
                ? "Alfi can also help with customer chats on your business WhatsApp. You can skip this and add it later."
                : "Alfi is your business assistant. We’ll set it up so you can start chatting right away."}
            </DialogDescription>
          </DialogHeader>

          {agentId ? (
            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Keep using WhatsApp as usual</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connect your business number when you’re ready. Alfi only helps when you ask.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="owner-phone">Your WhatsApp number</Label>
              <Input
                id="owner-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="972501234567"
                value={ownerPhone}
                onChange={(event) => setOwnerPhone(event.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Optional. This is how Alfi knows it’s you. You can add it later.
              </p>
            </div>
          )}

          <DialogFooter>
            {agentId ? (
              <>
                <Button variant="outline" onClick={finish} disabled={busy}>
                  Not now
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
                  {busy ? "Setting up..." : "Create Alfi"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
