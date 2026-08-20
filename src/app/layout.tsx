import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { branding } from "@/config/branding";
import { PwaRegistration } from "@/components/PwaRegistration";

export const metadata: Metadata = {
  title: branding.appName,
  description: `${branding.appName} — managed AI agents`,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: branding.appName,
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/alphi-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2c6b5c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <PwaRegistration />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
