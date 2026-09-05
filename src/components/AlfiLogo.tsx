import { cn } from "@/lib/utils";

export function AlfiMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("size-10 shrink-0", className)}><circle cx="32" cy="32" r="30" fill="#0B5138"/><circle cx="32" cy="32" r="29" fill="none" stroke="#FBF4E8" strokeWidth="2"/><path d="M17 19c7 6 18 14 29 26-3 3-5 5-8 7C29 37 21 31 14 25c0-2 1-4 3-6Z" fill="#E8B64F"/><path d="M15 47c6-11 15-18 29-22 2-1 3-2 4-5 2 12-4 20-13 25-8 5-15 7-20 6-1-1-1-3 0-4Z" fill="#FBF4E8"/><circle cx="38" cy="20" r="4.4" fill="#FBF4E8"/><path d="m49 12 1.3 3.1 3.2 1.4-3.2 1.3-1.3 3.2-1.4-3.2-3.1-1.3 3.1-1.4L49 12Z" fill="#E8B64F"/><g fill="#FBF4E8" opacity=".96"><path d="M25 9h8l-4 5Z"/><path d="m51 27 4 5-4 5Z"/><path d="m28 52 5 4h-9Z"/><path d="m9 27 5 5-5 5Z"/></g></svg>;
}

export function AlfiLogo({ className }: { className?: string }) {
  return <span dir="ltr" role="img" aria-label="Alfi" className={cn("inline-flex items-center gap-2.5 text-[#123D2D]", className)}><AlfiMark/><span aria-hidden="true" className="text-[32px] font-semibold leading-none tracking-[-0.055em]">Alfi</span></span>;
}
