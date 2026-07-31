"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
// 1. Importamos los iconos
import { Home, RefreshCw, Tent, CalendarDays, Warehouse } from "lucide-react";
import Logo from "@/components/Logo";

export default function BottomNav() {
  const pathname = usePathname();

  // 2. En el array, pasamos el COMPONENTE (sin comillas) en lugar del emoji string
  const links = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/plants", label: "Plantas", icon: () => <Logo className="w-6 h-6 mb-1" /> },
    { href: "/cycles", label: "Ciclos", icon: RefreshCw },
    { href: "/spaces", label: "Espacios", icon: Warehouse }, // O 'Warehouse' si prefieres
    { href: "/calendar", label: "Agenda", icon: CalendarDays },
  ];

  if (pathname === "/login") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      
      <nav className="bg-black/40 backdrop-blur-md border-t border-white/10 pb-safe pt-2 px-2 flex justify-around items-end shadow-2xl">
        
        {links.map((link) => {
          const isActive = pathname === link.href;
          // Guardamos el icono en una variable para renderizarlo como etiqueta
          const IconComponent = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex flex-col items-center min-h-[48px] min-w-[48px] justify-center w-full py-3 transition-all duration-300 relative outline-none tap-highlight-transparent`}
            >
              {isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-brand-primary rounded-full shadow-[0_0_10px_rgba(57,255,20,0.8)] "></span>
              )}

              {/* Renderizamos el componente del icono */}
              <IconComponent 
                className={`w-6 h-6 mb-1 transition-all duration-300 filter ${
                  isActive 
                    ? 'text-brand-primary scale-110 '
                    : 'text-muted group-hover:text-foreground scale-100'
                }`}
                // strokeWidth controla el grosor. 2 es normal, 2.5 es bold.
                strokeWidth={2} /* @ts-ignore */
              />
              
              <span 
                className={`text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                  isActive 
                    ? 'text-brand-primary' 
                    : 'text-muted'
                }`}
              >
                {link.label}
              </span>

            </Link>
          );
        })}
      </nav>
      
      <div className="h-6 bg-card dark:bg-background/80 backdrop-blur md:hidden"></div>
    </div>
  );
}