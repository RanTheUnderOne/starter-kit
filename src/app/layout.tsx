import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { branding } from "@/config/branding";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/components/LocaleProvider";
import { localeDirection, normalizeLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: branding.appName,
  description: `${branding.appName} — managed AI agents`,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("alfi_locale")?.value);
  return (
    <html lang={locale} dir={localeDirection(locale)} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <LocaleProvider initialLocale={locale}>
          {children}
          <Toaster richColors position="top-center" />
        </LocaleProvider>
      </body>
    </html>
  );
}
