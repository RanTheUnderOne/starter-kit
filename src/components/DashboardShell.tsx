"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Menu, Settings, Users, X } from "lucide-react";
import { useEffect } from "react";
import { branding } from "@/config/branding";
import { AccountMenu } from "@/components/AccountMenu";
import { useMobileDrawer } from "@/components/useMobileDrawer";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Agents", icon: LayoutGrid, exact: true },
  { href: "/dashboard/members", label: "Members", icon: Users, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { menuOpen, isDesktop, openMenu, closeMenu, triggerRef, drawerRef, onDrawerKeyDown } =
    useMobileDrawer();

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  return (
    <div className="min-h-dvh md:min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="Alphi" className="h-8 w-auto object-contain" />
          ) : null}
          <span className="font-semibold">{branding.appName}</span>
        </div>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          onClick={openMenu}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {menuOpen && <button type="button" aria-label="Close navigation menu" className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={closeMenu} />}

      <div className="flex min-h-[calc(100dvh-57px)] md:min-h-screen">
      <aside
        ref={drawerRef}
        tabIndex={-1}
        role={!isDesktop ? "dialog" : undefined}
        aria-label="Dashboard navigation"
        aria-modal={!isDesktop && menuOpen ? true : undefined}
        inert={!isDesktop && !menuOpen}
        aria-hidden={!isDesktop && !menuOpen}
        onKeyDown={onDrawerKeyDown}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r bg-card p-4 transition-transform md:static md:z-auto md:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full md:static md:translate-x-0"
        )}
      >
        <div className="flex justify-end md:hidden">
          <button type="button" aria-label="Close navigation menu" onClick={closeMenu} className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 px-2 py-1">
          {branding.logoUrl ? (
            <div className="rounded-2xl bg-secondary/70 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={branding.logoUrl} alt="Alphi" className="h-9 w-auto object-contain" />
            </div>
          ) : null}
          <span className="truncate font-semibold">{branding.appName}</span>
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Account + workspace switcher, pinned to the bottom near the user's identity. */}
        <div className="mt-auto border-t pt-3">
          <AccountMenu />
        </div>
      </aside>

      <main
        inert={!isDesktop && menuOpen}
        aria-hidden={!isDesktop && menuOpen}
        className="min-w-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</div>
      </main>
      </div>
    </div>
  );
}
