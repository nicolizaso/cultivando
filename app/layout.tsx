import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import DesktopNavbar from "@/components/DesktopNavbar";
import { ToastProvider } from "@/app/context/ToastContext";
import { ThemeProvider } from "@/components/ThemeProvider";

const outfit = Outfit({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cultiva con el Primo",
  description: "Gestión inteligente de cultivos",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  // Sin maximumScale ni userScalable: bloquear el zoom rompe WCAG 1.4.4.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1512" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${outfit.variable} antialiased bg-background text-foreground min-h-[100dvh]`}
      >
        <ThemeProvider>
          <ToastProvider>
            <a href="#contenido" className="skip-link">
              Saltar al contenido principal
            </a>

            <DesktopNavbar />

            <div id="contenido" className="pb-28 md:pb-0">
              {children}
            </div>

            <BottomNav />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
