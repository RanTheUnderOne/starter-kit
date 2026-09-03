"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { alfiWhatsAppTalkUrl, configuredAlfiWhatsAppDigits } from "@/lib/alfi-whatsapp-link";
import { cn } from "@/lib/utils";

export function TalkToAlfiWhatsAppLink({
  className,
  fallbackHref,
}: {
  className?: string;
  fallbackHref?: string;
}) {
  const { t } = useLocale();
  const greeting = t("chat.whatsappGreeting");
  const [url, setUrl] = useState<string | null>(() =>
    alfiWhatsAppTalkUrl(configuredAlfiWhatsAppDigits(), greeting),
  );

  useEffect(() => {
    if (url) return;
    let cancelled = false;
    void fetch("/api/whatsapp/talk")
      .then((response) => (response.ok ? response.json() : { digits: null }))
      .then((body: { digits?: string | null }) => {
        if (cancelled) return;
        setUrl(alfiWhatsAppTalkUrl(body.digits ?? "", greeting));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [greeting, url]);

  const href = url ?? fallbackHref;
  if (!href) return null;

  return (
    <a
      href={href}
      target={url ? "_blank" : undefined}
      rel={url ? "noreferrer" : undefined}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full bg-[#128C7E] px-5 text-sm font-semibold text-white transition hover:bg-[#0e7a6e]",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" />
      {t("chat.whatsapp")}
    </a>
  );
}
