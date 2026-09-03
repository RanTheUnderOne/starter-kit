"use client";

import { useEffect, useState } from "react";
import type { CronJob, CronJobInput } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
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

const PRESETS = [
  { value: "0 8 * * *", key: "schedules.daily8" as const },
  { value: "0 8 * * 0-4", key: "schedules.weekdays8" as const },
  { value: "0 18 * * 0-4", key: "schedules.weekdays18" as const },
  { value: "every 1h", key: "schedules.hourly" as const },
];

export function ScheduleEditor({
  open,
  onOpenChange,
  initial,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: CronJob | null;
  busy: boolean;
  onSave: (input: CronJobInput) => Promise<void>;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState(PRESETS[1].value);
  const [prompt, setPrompt] = useState("");
  const preset = PRESETS.some((item) => item.value === schedule) ? schedule : "custom";

  useEffect(() => {
    if (!open) return;
    setName(initial?.displayName ?? "");
    setSchedule(initial?.schedule || PRESETS[1].value);
    setPrompt(initial?.prompt ?? "");
  }, [initial, open]);

  async function submit() {
    if (!name.trim() || !schedule.trim() || !prompt.trim()) return;
    await onSave({ name: name.trim(), schedule: schedule.trim(), prompt: prompt.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-teal-950/10 bg-[#fffdf8] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? t("schedules.update") : t("schedules.create")}</DialogTitle>
          <DialogDescription>Asia/Jerusalem</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="schedule-name">{t("schedules.name")}</Label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-when">{t("schedules.when")}</Label>
            <select
              id="schedule-when"
              value={preset}
              onChange={(event) => {
                if (event.target.value !== "custom") setSchedule(event.target.value);
                else if (PRESETS.some((item) => item.value === schedule)) setSchedule("");
              }}
              className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            >
              {PRESETS.map((item) => (
                <option key={item.value} value={item.value}>{t(item.key)}</option>
              ))}
              <option value="custom">{t("schedules.custom")}</option>
            </select>
            {preset === "custom" && (
              <Input
                value={schedule}
                onChange={(event) => setSchedule(event.target.value)}
                placeholder="0 9 * * 0-4"
                dir="ltr"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-task">{t("schedules.task")}</Label>
            <textarea
              id="schedule-task"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={20_000}
              rows={6}
              className="w-full resize-y rounded-xl border border-input bg-white/70 px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim() || !schedule.trim() || !prompt.trim()}>
            {busy ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

