"use client";

import type { Role } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { BusinessProfile } from "@/components/BusinessProfile";
import { WhatsAppStatusSection } from "@/components/WhatsAppStatusSection";

export function BusinessTab({ agentId, role }: { agentId: string; role: Role }) {
  const { locale } = useLocale();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 pb-28 pt-7 sm:px-7 lg:px-10 lg:pb-12 lg:pt-10">
      <header>
        <p className="alfi-eyebrow">{locale === "he" ? "הכל מתחיל בעסק שלך" : "BUILT AROUND YOUR BUSINESS"}</p>
        <h1 className="alfi-page-title">{locale === "he" ? "העסק שלך" : "Your business"}</h1>
        <p className="alfi-page-description">{locale === "he" ? "פרטי העסק וההעדפות שלך, במקום אחד." : "Your business details and preferences, in one place."}</p>
      </header>
      <BusinessProfile />
      <div className="pt-5"><h2 className="text-xl font-semibold">{locale === "he" ? "איפה Alfi עובד איתך" : "Where Alfi works with you"}</h2><p className="alfi-page-description">{locale === "he" ? "חיבור העסק ללקוחות, וקו פרטי בשבילך." : "A connection to your customers, and a private line for you."}</p></div>
      <WhatsAppStatusSection agentId={agentId} role={role} />
    </div>
  );
}
