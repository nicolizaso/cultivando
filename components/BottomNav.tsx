"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, RefreshCw, CalendarDays, Warehouse } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Logo from "@/components/Logo";

const LINKS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/plants", label: "Plantas", icon: Logo },
  { href: "/cycles", label: "Ciclos", icon: RefreshCw },
  { href: "/spaces", label: "Espacios", icon: Warehouse },
  { href: "/calendar", label: "Agenda", icon: CalendarDays },
];

export default function BottomNav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (pathname === "/login") return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="chrome-bar fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch justify-around px-1 pt-1 pb-1">
        {LINKS.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className="group relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] px-1 py-2"
              >
                {/* Fondo del estado activo: se desplaza entre pestañas en vez de aparecer de golpe */}
                {isActive && (
                  <motion.span
                    layoutId={reduceMotion ? undefined : "bottom-nav-active"}
                    className="absolute inset-x-1 inset-y-0 -z-10 rounded-[var(--radius-md)] bg-brand-soft"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    aria-hidden="true"
                  />
                )}

                <Icon
                  className={`h-[22px] w-[22px] transition-colors ${
                    isActive ? "text-[color:var(--brand-text)]" : "text-fg-muted group-hover:text-fg"
                  }`}
                  strokeWidth={isActive ? 2.4 : 2}
                  aria-hidden="true"
                />

                <span
                  className={`text-[10px] font-semibold tracking-wide transition-colors ${
                    isActive ? "text-[color:var(--brand-text)]" : "text-fg-muted group-hover:text-fg"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
