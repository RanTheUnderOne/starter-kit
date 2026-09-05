"use client";

import { useEffect, useState } from "react";
import { Building2, Mail, Globe2, Check } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { useLocale } from "@/components/LocaleProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BusinessProfile() {
  const { current, userEmail, refresh } = useWorkspace();
  const { locale, t } = useLocale();
  const he = locale === "he";
  const [name, setName] = useState(current?.name ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(current?.name ?? ""), [current?.name]);
  async function save() {
    if (!current || !name.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/workspaces/${current.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      await refresh();
      toast.success(he ? "פרטי העסק עודכנו" : "Business details updated");
    } catch { toast.error(t("common.error")); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <section className="alfi-surface p-6 sm:p-8">
      <div className="mb-7 flex items-center gap-3"><span className="alfi-icon-tile"><Building2 size={20} /></span><div><h2 className="font-semibold">{he ? "פרטי העסק" : "Business details"}</h2><p className="mt-1 text-sm text-muted-foreground">{he ? "הבסיס לעבודה המשותפת עם Alfi." : "The foundation for your work with Alfi."}</p></div></div>
      <Label htmlFor="business-name">{he ? "שם העסק" : "Business name"}</Label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row"><Input id="business-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} disabled={busy} className="h-11 flex-1" /><Button className="h-11" onClick={save} disabled={busy || !name.trim() || name.trim() === current?.name}><Check size={16} />{busy ? t("common.loading") : t("common.save")}</Button></div>
    </section>
    <section className="alfi-surface divide-y divide-border">
      <div className="flex items-center gap-4 p-6 sm:px-8"><span className="alfi-icon-tile"><Mail size={19} /></span><div className="min-w-0"><h2 className="text-sm font-semibold">{he ? "החשבון שלך" : "Your account"}</h2><p dir="ltr" className="mt-1 truncate text-sm text-muted-foreground">{userEmail}</p></div></div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:px-8"><div className="flex items-center gap-4"><span className="alfi-icon-tile"><Globe2 size={19} /></span><div><h2 className="text-sm font-semibold">{he ? "שפת הממשק" : "Interface language"}</h2><p className="mt-1 text-sm text-muted-foreground">{he ? "אפשר להחליף בכל רגע." : "Switch whenever you like."}</p></div></div><LanguageToggle /></div>
    </section>
  </div>;
}
