"use client";

import { useState, useRef, useEffect } from "react";
import { signout } from "@/app/login/actions";
import { LogOut, User, Settings, ChevronDown } from "lucide-react";

export default function UserMenu({ email }: { email?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <div className="relative" ref={menuRef}>
      {/* AVATAR TRIGGER */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-all border ${
            isOpen 
            ? 'bg-card border-brand-primary text-foreground shadow-[0_0_15px_rgba(0,165,153,0.3)]'
            : 'bg-card border-card-border text-muted hover:border-brand-primary/50 hover:text-foreground'
        }`}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
            isOpen ? 'bg-brand-primary text-white' : 'bg-slate-50 text-brand-primary group-hover:bg-brand-primary group-hover:text-white'
        }`}>
            {initial}
        </div>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* DROPDOWN MODAL (Estilo Bento) */}
      {isOpen && (
        <div className="absolute right-0 top-14 w-64 bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header del Modal */}
          <div className="p-4 border-b border-card-border bg-slate-50/50">
            <div className="flex items-center gap-3 mb-1">
                <div className="p-1.5 bg-brand-primary/10 rounded-lg text-brand-primary">
                    <User size={16} />
                </div>
                <span className="text-[10px] text-muted uppercase font-bold tracking-widest">Cuenta</span>
            </div>
            <p className="text-sm text-foreground font-medium truncate font-body pl-1" title={email}>
                {email || "Usuario"}
            </p>
          </div>

          {/* Opciones */}
          <div className="p-2 space-y-1">
            {/* Botón Fake de Configuración (para futuro) */}
            <button 
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-foreground hover:bg-card-border transition-colors group text-left"
                onClick={() => alert("Próximamente: Ajustes de cuenta")}
            >
                <Settings size={16} className="text-muted group-hover:text-brand-primary transition-colors" />
                Configuración
            </button>

            <div className="h-px bg-card-border my-1 mx-2"></div>

            {/* Botón Cerrar Sesión */}
            <button 
                onClick={() => signout()} 
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors group text-left"
            >
                <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                Cerrar Sesión
            </button>
          </div>
          
          {/* Footer decorativo */}
          <div className="h-1 w-full bg-linear-to-r from-brand-primary/0 via-brand-primary/20 to-brand-primary/0"></div>
        </div>
      )}
    </div>
  );
}