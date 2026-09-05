"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Settings, Users } from "lucide-react";
import { AlfiLogo } from "@/components/AlfiLogo";
import { AccountMenu } from "@/components/AccountMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { isStaff } = useWorkspace();

  const nav = [
    { href: "/dashboard", label: t("fleet.title"), icon: LayoutGrid, exact: true },
    ...(isStaff
      ? [
          { href: "/dashboard/members", label: t("nav.members"), icon: Users, exact: false },
          { href: "/dashboard/settings", label: t("nav.settings"), icon: Settings, exact: false },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b bg-muted/60 p-5 md:w-60 md:border-b-0 md:border-e">
        <div className="flex items-center gap-2 px-2 py-1">
          <AlfiLogo />
        </div>

        <nav className="mt-6 flex flex-row flex-wrap gap-1 md:flex-col">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 flex items-center gap-3 border-t pt-3 md:mt-auto md:block md:space-y-3">
          <LanguageToggle />
          <AccountMenu />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}
