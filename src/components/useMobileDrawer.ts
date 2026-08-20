"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.tabIndex >= 0 && element.getAttribute("aria-hidden") !== "true"
  );
}

// Shared modal behavior for the below-md navigation drawers. At md+ the rail is ordinary page
// navigation; below md it receives focus, traps Tab, closes on Escape, and restores its trigger.
export function useMobileDrawer() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const wasMobileOpen = useRef(false);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateIsDesktop = () => {
      setIsDesktop(mediaQuery.matches);
      if (mediaQuery.matches) setMenuOpen(false);
    };
    updateIsDesktop();
    mediaQuery.addEventListener("change", updateIsDesktop);
    return () => mediaQuery.removeEventListener("change", updateIsDesktop);
  }, []);

  useEffect(() => {
    const mobileOpen = menuOpen && !isDesktop;
    if (mobileOpen) {
      wasMobileOpen.current = true;
      const frame = requestAnimationFrame(() => {
        const drawer = drawerRef.current;
        if (!drawer) return;
        const focusable = getFocusable(drawer);
        if (focusable.length > 0) focusable[0].focus();
        else drawerRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }

    if (wasMobileOpen.current && !isDesktop) triggerRef.current?.focus();
    wasMobileOpen.current = false;
  }, [isDesktop, menuOpen]);

  const onDrawerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (isDesktop || !menuOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;

      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = getFocusable(drawer);
      if (focusable.length === 0) {
        event.preventDefault();
        drawerRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !drawer.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !drawer.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    },
    [closeMenu, isDesktop, menuOpen]
  );

  return {
    menuOpen,
    isDesktop,
    openMenu,
    closeMenu,
    triggerRef,
    drawerRef,
    onDrawerKeyDown,
  };
}
