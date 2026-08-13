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
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      setMsg({ type: 'error', text: 'Error de conexión.' })
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center p-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="surface mb-4 flex h-20 w-20 items-center justify-center rounded-[var(--radius-xl)]">
          <Image src="/logo-login.png" alt="" width={60} height={60} className="h-12 w-12 object-contain" />
        </span>
        <h1 className="font-title text-xl font-semibold tracking-tight text-fg">Cultiva con el Primo</h1>
        <p className="mt-1 text-sm text-fg-muted">Gestión inteligente de cultivos</p>
      </div>

      <div className="surface w-full max-w-sm rounded-[var(--radius-xl)] p-6">
        {/* Conmutador ingresar/registrarse como grupo de pestañas real */}
        <div role="tablist" aria-label="Modo de acceso" className="mb-6 flex gap-1 rounded-[var(--radius-md)] border border-line bg-surface-2 p-1">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            onClick={() => { setIsLogin(true); setMsg(null); }}
            className={`flex-1 rounded-[var(--radius-sm)] py-2.5 text-sm font-semibold transition-colors ${
              isLogin ? 'bg-brand text-[color:var(--brand-fg)]' : 'text-fg-muted hover:text-fg'
            }`}
          >
            Ingresar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            onClick={() => { setIsLogin(false); setMsg(null); }}
            className={`flex-1 rounded-[var(--radius-sm)] py-2.5 text-sm font-semibold transition-colors ${
              !isLogin ? 'bg-brand text-[color:var(--brand-fg)]' : 'text-fg-muted hover:text-fg'
            }`}
          >
            Registrarse
          </button>
        </div>

        {msg && (
          <p
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-[var(--radius-md)] border border-[color:color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color:var(--danger-soft)] p-3 text-sm font-medium text-[color:var(--danger)]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {msg.text}
          </p>
        )}

        <form onSubmit={handleOnSubmit} className="space-y-4">
          {!isLogin && (
            <div className="field">
              <label htmlFor="login-username" className="field-label">Usuario</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required={!isLogin}
                  placeholder="Nombre de usuario"
                  className="field-input pl-10"
                />
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="login-email" className="field-label">
              {isLogin ? 'Email o usuario' : 'Email'}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
              <input
                id="login-email"
                name="email"
                type="text"
                autoComplete={isLogin ? 'username' : 'email'}
                required
                placeholder={isLogin ? 'Email o usuario' : 'tu@email.com'}
                className="field-input pl-10"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="login-password" className="field-label">Contraseña</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                placeholder="Tu contraseña"
                className="field-input pl-10"
              />
            </div>
          </div>

          {!isLogin && (
            <div className="field">
              <label htmlFor="login-confirm" className="field-label">Repetir contraseña</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
                <input
                  id="login-confirm"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required={!isLogin}
                  placeholder="Repetí la contraseña"
                  className="field-input pl-10"
                />
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary mt-2 w-full">
            {loading ? (
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
            ) : (
              <>
                {isLogin ? 'Ingresar' : 'Crear cuenta'}
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
