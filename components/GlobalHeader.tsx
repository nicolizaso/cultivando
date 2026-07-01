"use client";

import { useState } from "react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { Sprout, Menu, X, FlaskConical, LogOut } from "lucide-react";
import { signout } from "@/app/login/actions";

interface GlobalHeaderProps {
  title?: string;
  subtitle?: string;
  userEmail?: string;
}

export default function GlobalHeader({ title, subtitle, userEmail }: GlobalHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="flex justify-between items-center mb-6 pt-2">
      <div className="flex flex-col">
        {/* LOGO / NOMBRE APP */}
        <div className="flex items-center gap-2 mb-1">
            {/* Icono Vectorial Institucional */}
            <Sprout className="text-brand-primary w-6 h-6" strokeWidth={2.5} />
            
            <span className="font-title text-brand-text text-lg tracking-wider uppercase">
                Cultivapp
            </span>
        </div>
        
        {title && (
            <h1 className="text-sm font-bold font-body text-brand-muted hidden md:block">
                {title} {subtitle && <span className="font-normal opacity-50">| {subtitle}</span>}
            </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Desktop elements */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          <UserMenu email={userEmail} />
        </div>

        {/* Mobile menu button */}
        <button
          className="flex md:hidden p-2 rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          onClick={() => setIsMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Drawer/Modal */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-[#F5F5F1] dark:bg-[#0B0C10] flex flex-col md:hidden animate-in slide-in-from-right-full duration-300">
          {/* Header del menú */}
          <div className="flex justify-between items-center p-6 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Sprout className="text-brand-primary w-6 h-6" strokeWidth={2.5} />
              <span className="font-title text-brand-text text-lg tracking-wider uppercase">
                Cultivapp
              </span>
            </div>
            <button
              className="p-2 rounded-full text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              <X size={24} />
            </button>
          </div>

          {/* Navegación y Contenido principal */}
          <div className="flex-1 p-6 space-y-8 overflow-y-auto">
            <div className="space-y-4">
              <h2 className="font-title text-xs font-bold text-muted uppercase tracking-widest">Secciones</h2>
              <div className="flex flex-col gap-2">
                <Link
                  href="/fertilizers"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-card-border shadow-sm text-foreground hover:border-brand-primary/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                    <FlaskConical size={20} />
                  </div>
                  <span className="font-sans text-lg font-medium">Nutrición</span>
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="font-title text-xs font-bold text-muted uppercase tracking-widest">Preferencias</h2>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-card-border shadow-sm text-foreground">
                <span className="font-sans font-medium">Tema Visual</span>
                <ThemeToggle />
              </div>
            </div>
          </div>

          {/* Sección Usuario (Bottom) */}
          <div className="p-6 border-t border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold">
                {userEmail ? userEmail[0].toUpperCase() : "U"}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="font-sans text-sm font-medium truncate" title={userEmail}>
                  {userEmail || "Usuario"}
                </p>
                <p className="font-sans text-xs text-muted">Cuenta Activa</p>
              </div>
            </div>

            <button
              onClick={() => signout()}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl text-red-500 bg-red-500/10 hover:bg-red-500/20 font-sans font-medium transition-colors"
            >
              <LogOut size={20} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
