'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { login, signup } from './actions'
import { ArrowRight, Loader2, User, Mail, Lock, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const handleOnSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    const formData = new FormData(e.currentTarget)

    try {
      const action = isLogin ? login : signup
      const res = await action(formData)

      if (res?.error) {
        setMsg({ type: 'error', text: res.error })
        setLoading(false)
      } else if (res?.success) {
        router.push('/') // Redirección al Dashboard
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: 'Error de conexión.' })
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 relative">
      
      {/* Logo y Título */}
      <div className="flex flex-col items-center mb-8 text-center z-10">
        <div className="bg-brand-card p-4 mb-4 rounded-2xl border border-brand-card-border shadow-sm">
          <Image src="/logo-login.png" alt="Logo" width={60} height={60} className="w-12 h-12 object-contain" />
        </div>
        <h1 className="text-xl font-bold text-brand-text tracking-widest uppercase">
          CULTIVAPP
        </h1>
      </div>

      {/* Tarjeta Bento */}
      <div className="w-full max-w-sm bg-brand-card border border-brand-card-border rounded-2xl p-6 shadow-sm backdrop-blur-md z-10">
        
        {/* Toggle Login/Registro */}
        <div className="flex bg-brand-bg p-1 rounded-xl mb-6 border border-brand-card-border">
          <button
            onClick={() => { setIsLogin(true); setMsg(null); }}
            className={`flex-1 text-xs font-bold py-3 rounded-lg transition-all ${
              isLogin ? 'bg-slate-100 text-brand-text shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            INGRESAR
          </button>
          <button
            onClick={() => { setIsLogin(false); setMsg(null); }}
            className={`flex-1 text-xs font-bold py-3 rounded-lg transition-all ${
              !isLogin ? 'bg-slate-100 text-brand-text shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            REGISTRARSE
          </button>
        </div>

        {msg && (
          <div className="mb-4 p-3 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2">
            <AlertCircle size={14} />
            {msg.text}
          </div>
        )}

        <form onSubmit={handleOnSubmit} className="space-y-4">
          
          {/* Campo Username (Solo Registro) */}
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 text-muted" size={16} />
                <input
                  name="username"
                  type="text"
                  required={!isLogin}
                  placeholder="Nombre de Usuario"
                  className="w-full bg-brand-bg border border-brand-card-border rounded-xl py-3 pl-10 pr-4 text-brand-text text-sm outline-none focus:border-brand-primary transition-colors"
                />
              </div>
            </div>
          )}

          {/* Campo Email / Usuario Login */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted ml-1">
              {isLogin ? 'Email o Usuario' : 'Email'}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-muted" size={16} />
              <input
                name="email"
                type="text"
                required
                placeholder={isLogin ? "Email o Usuario" : "tu@email.com"}
                className="w-full bg-brand-bg border border-brand-card-border rounded-xl py-3 pl-10 pr-4 text-brand-text text-sm outline-none focus:border-brand-primary transition-colors"
              />
            </div>
          </div>

          {/* Campo Password */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted ml-1">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-muted" size={16} />
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-brand-bg border border-brand-card-border rounded-xl py-3 pl-10 pr-4 text-brand-text text-sm outline-none focus:border-brand-primary transition-colors"
              />
            </div>
          </div>

          {/* Campo Repetir Password (Solo Registro) */}
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted ml-1">Repetir Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 text-muted" size={16} />
                <input
                  name="confirmPassword"
                  type="password"
                  required={!isLogin}
                  placeholder="••••••••"
                  className="w-full bg-brand-bg border border-brand-card-border rounded-xl py-3 pl-10 pr-4 text-brand-text text-sm outline-none focus:border-brand-primary transition-colors"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                {isLogin ? 'INGRESAR' : 'CREAR CUENTA'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}