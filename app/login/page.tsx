'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AlertCircle, ArrowRight, CalendarCheck, FlaskConical, Loader2, Lock, Mail, RefreshCw, User } from 'lucide-react'
import { login, signup } from './actions'
import Logo from '@/components/Logo'
import { BRAND_NAME, BRAND_TAGLINE } from '@/components/Brand'

const HIGHLIGHTS = [
  { icon: RefreshCw, title: 'Ciclos y plantas', text: 'Cada tanda con su día de cultivo, su etapa y su historial.' },
  { icon: CalendarCheck, title: 'Agenda de tareas', text: 'Riegos, podas y cambios de etapa en un calendario.' },
  { icon: FlaskConical, title: 'Nutrición', text: 'Tus fertilizantes y combos, con la dosis ya calculada.' },
]

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
    <main className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca. En móvil se reduce a una cabecera para que el
          formulario siga entrando en pantalla sin desplazarse. */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-brand px-6 py-8 text-[color:var(--brand-fg)] sm:px-10 lg:px-14 lg:py-14">
        {/* Foto del cultivo como textura del panel. El desenfoque es leve
            (las plantas se siguen leyendo) y el velo de marca en degradado
            es más opaco del lado del texto, que es donde hay que garantizar
            contraste; hacia la derecha se abre y la foto respira.
            Medido sobre el peor píxel de foto que queda debajo de cada
            bloque de texto: ≥4.78:1 en los dos temas, AA con margen. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* El scale evita el borde translúcido que el blur deja al recortar. */}
          <Image
            src="/login-cultivo.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="scale-[1.04] object-cover object-center blur-[2px]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[color-mix(in_srgb,var(--brand)_92%,transparent)] via-[color-mix(in_srgb,var(--brand)_80%,transparent)] via-60% to-[color-mix(in_srgb,var(--brand)_76%,transparent)] lg:to-[color-mix(in_srgb,var(--brand)_58%,transparent)]" />
        </div>

        {/* La foto ya aporta relieve, así que los halos bajan de intensidad. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 60% 50% at 15% 0%, #ffffff, transparent 60%), radial-gradient(ellipse 50% 60% at 95% 100%, #ffffff, transparent 55%)',
          }}
          aria-hidden="true"
        />

        <div className="relative">
          <span className="inline-flex items-center gap-3">
            {/* Sobre el verde de marca la tesela se invierte: fondo claro y
                brote verde, para que el logotipo no desaparezca en el fondo. */}
            <span
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--brand-fg)] text-[color:var(--brand)]"
              aria-hidden="true"
            >
              <Logo className="h-6 w-6" strokeWidth={2.1} />
            </span>
            <span className="font-title text-xl font-semibold tracking-tight">{BRAND_NAME}</span>
          </span>
        </div>

        <div className="relative my-10 max-w-md lg:my-0">
          <h1 className="font-title text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-[44px]">
            {BRAND_TAGLINE}
          </h1>
          <p className="mt-3 text-sm leading-relaxed opacity-90 sm:text-base">
            Llevá el registro de tus ciclos sin cuadernos ni fotos sueltas en el teléfono.
          </p>
        </div>

        <ul className="relative hidden max-w-md space-y-4 lg:block">
          {HIGHLIGHTS.map(item => {
            const Icon = item.icon
            return (
              <li key={item.title} className="flex items-start gap-3.5">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--brand-fg)_16%,transparent)]"
                  aria-hidden="true"
                >
                  <Icon size={17} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-sm opacity-90">{item.text}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Panel de acceso */}
      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <h2 className="font-title text-2xl font-semibold tracking-tight text-fg">
            {isLogin ? 'Entrá a tu cultivo' : 'Creá tu cuenta'}
          </h2>
          <p className="mt-1 mb-6 text-sm text-fg-muted">
            {isLogin ? 'Usá tu email o tu nombre de usuario.' : 'Con un email alcanza para empezar.'}
          </p>

          {/* Conmutador ingresar/registrarse como grupo de pestañas real */}
          <div role="tablist" aria-label="Modo de acceso" className="segmented mb-6 grid w-full grid-cols-2">
            <button
              type="button"
              role="tab"
              id="tab-login"
              aria-selected={isLogin}
              onClick={() => { setIsLogin(true); setMsg(null); }}
              className="segmented-item"
            >
              Ingresar
            </button>
            <button
              type="button"
              role="tab"
              id="tab-signup"
              aria-selected={!isLogin}
              onClick={() => { setIsLogin(false); setMsg(null); }}
              className="segmented-item"
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
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required={!isLogin}
                    placeholder="Cómo querés que te llamemos"
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
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
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
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
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
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
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
      </section>
    </main>
  )
}
