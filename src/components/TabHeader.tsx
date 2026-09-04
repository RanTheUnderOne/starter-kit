import React from "react";
import { cn } from "@/lib/utils";

interface TabHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function TabHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: TabHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/80">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
