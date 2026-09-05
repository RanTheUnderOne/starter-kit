"use client";
import { ArrowUpRight, Sunrise, MessagesSquare, UserRoundSearch } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";


export function ChatStarters({ onStart, disabled }: { onStart: (prompt: string) => Promise<void>; disabled: boolean }) {
  const { locale } = useLocale();

  const he = locale === "he";
  const starters = [
    { icon: Sunrise, title: he ? "פותחים את היום" : "Start my day", detail: he ? "מה דורש תשומת לב הבוקר?" : "What needs my attention?", prompt: he ? "בדוק את המקורות המחוברים וסכם מה דורש את תשומת הלב שלי הבוקר. ציין מה בדקת והצע צעדים להמשך." : "Review my connected sources and summarize what needs my attention this morning. Say what you checked and suggest next steps." },
    { icon: UserRoundSearch, title: he ? "לא מפספסים ליד" : "Catch every lead", detail: he ? "מי עדיין מחכה לתשובה?" : "Who is still waiting for a reply?", prompt: he ? "בדוק אם יש לידים שממתינים לתשובה במקורות המחוברים. סדר לפי חשיבות והצע למי לחזור קודם." : "Check my connected sources for leads waiting for a reply. Prioritize them and suggest who to follow up with first." },
    { icon: MessagesSquare, title: he ? "מנסחים את הצעד הבא" : "Draft the next step", detail: he ? "פולואפ מדויק, לאישור שלך" : "A thoughtful follow-up, for your approval", prompt: he ? "עזור לי לנסח הודעת המשך ללקוח. שאל אותי למי ההודעה ומה ההקשר לפני הכנת הטיוטה. אל תשלח אותה." : "Help me draft a customer follow-up. Ask who it is for and the context before drafting. Do not send it." },
  ];
  return <div className="alfi-starters">{starters.map(({ icon: Icon, title, detail, prompt }) => <button key={title} type="button" disabled={disabled} onClick={() => { void onStart(prompt); }} className="alfi-starter"><span className="alfi-icon-tile"><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span><ArrowUpRight className="size-4 shrink-0 text-primary/55 rtl:-rotate-90" /></button>)}</div>;
}
