"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  localeDirection,
  messages,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

const COOKIE_NAME = "alfi_locale";

type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: (key: MessageKey) => string;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    const dir = localeDirection(next);
    document.documentElement.lang = next;
    document.documentElement.dir = dir;
    document.cookie = `${COOKIE_NAME}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir: localeDirection(locale), t: (key) => messages[locale][key], setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}

