import { cn } from "@/lib/utils";

/** A dotted capital A: solid at the base, lighter toward the apex. */
export function AlfiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true" className={cn("size-9 shrink-0", className)}>
      <circle cx="24" cy="6" r="3" />
      <circle cx="19" cy="15" r="3.4" /><circle cx="29" cy="15" r="2.8" />
      <circle cx="14" cy="24" r="3.8" /><circle cx="34" cy="24" r="3.2" />
      <circle cx="9" cy="33" r="4" /><circle cx="19" cy="33" r="3" />
      <circle cx="29" cy="33" r="2.6" /><circle cx="39" cy="33" r="3.6" />
      <circle cx="5" cy="43" r="4" /><circle cx="43" cy="43" r="4" />
    </svg>
  );
}

export function AlfiLogo({ className }: { className?: string }) {
  return (
    <span dir="ltr" role="img" aria-label="Alfi" className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <AlfiMark />
      <span aria-hidden="true" className="text-[32px] font-semibold leading-none tracking-[-0.065em]">Alfi</span>
    </span>
  );
}
