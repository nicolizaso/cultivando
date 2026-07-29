import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import DesktopNavbar from "@/components/DesktopNavbar";
import { ToastProvider } from "@/app/context/ToastContext"; // <--- Importamos el Provider
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Cultivapp",
  description: "Gestión inteligente de cultivos",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0B0F19",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <body className={`${inter.variable} antialiased bg-background text-foreground transition-colors duration-300 min-h-screen`}>
        <ThemeProvider>
          {/* Envolvemos la app en el ToastProvider */}
          <ToastProvider>
            <DesktopNavbar />
            {/* Contenedor principal */}
            <div className="pb-24 md:pb-0">
                {children}
            </div>

            {/* Navbar Flotante */}
            <BottomNav />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
