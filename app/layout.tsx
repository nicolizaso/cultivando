import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import DesktopNavbar from "@/components/DesktopNavbar";
import { ToastProvider } from "@/app/context/ToastContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { createClient } from "@/app/lib/supabase-server";

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

/* Sólo para cifras: días de cultivo, temperatura, VPD. Un peso, un subset. */
const jetbrainsMono = JetBrains_Mono({
  weight: ["500"],
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Cultivando",
    template: "%s · Cultivando",
  },
  description:
    "Seguimiento de cultivo: ciclos, plantas, espacios, agenda de tareas y nutrición, en una sola app.",
  applicationName: "Cultivando",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Cultivando",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Sin maximumScale ni userScalable: bloquear el zoom rompe WCAG 1.4.4.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1310" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // La identidad se resuelve una sola vez acá. Antes cada página se la pasaba
  // a su propia cabecera, y la navegación no tenía forma de conocerla.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${outfit.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground min-h-[100dvh]`}
      >
        <ThemeProvider>
          <ToastProvider>
            <a href="#contenido" className="skip-link">
              Saltar al contenido principal
            </a>

            <DesktopNavbar email={user?.email} />

            {/* El hueco inferior deja respirar la barra de pestañas de móvil. */}
            <div id="contenido" className="pb-[calc(var(--nav-bottom)+1.5rem)] lg:pb-0">
              {children}
            </div>

            <BottomNav email={user?.email} />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
