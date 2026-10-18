'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/lib/supabase-server'
import { createAdminClient } from '@/app/lib/supabase-admin'

/** Mínimo de la contraseña al registrarse. */
const MIN_PASSWORD_LENGTH = 8

/** Letras, números, punto, guion y guion bajo; entre 3 y 30 caracteres. */
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Cuando el usuario no existe se intenta igual con un email que nunca va a
 * coincidir: así la respuesta tarda lo mismo y no delata qué usuarios hay.
 */
const UNKNOWN_EMAIL = 'non-existent-user@example.com'

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Usuario → email, del lado del servidor.
 *
 * La función de la base que lo resuelve ya no se puede llamar sin sesión:
 * abierta al público, cualquiera con la clave anónima podía averiguar el
 * email de cualquier usuario. Ahora la llama sólo el servidor, con la clave
 * de servicio.
 *
 * Devuelve `undefined` si el servidor no tiene la clave configurada.
 */
async function emailForUsername(username: string): Promise<string | null | undefined> {
  const admin = createAdminClient()
  if (!admin) return undefined

  const { data, error } = await admin.rpc('email_for_username', { p_username: username })
  if (error) {
    console.error('No se pudo resolver el usuario:', error)
    return null
  }
  return data ?? null
}

export async function login(formData: FormData) {
  const loginInput = readText(formData, 'email')
  const password = String(formData.get('password') ?? '')

  if (!loginInput || !password) return { error: 'Completá tu usuario o email y la contraseña.' }

  let email = loginInput

  if (!loginInput.includes('@')) {
    const resolved = await emailForUsername(loginInput)
    if (resolved === undefined) {
      console.error('Falta SUPABASE_SERVICE_ROLE_KEY: el ingreso con usuario está deshabilitado.')
      return { error: 'Por ahora ingresá con tu email en vez del usuario.' }
    }
    email = resolved || UNKNOWN_EMAIL
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Credenciales inválidas.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signup(formData: FormData) {
  const email = readText(formData, 'email').toLowerCase()
  const username = readText(formData, 'username')
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (!email || !password || !username) return { error: 'Todos los campos son obligatorios.' }
  if (!EMAIL_PATTERN.test(email)) return { error: 'Ese email no parece válido.' }
  if (!USERNAME_PATTERN.test(username)) {
    return { error: 'El usuario tiene que tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.' }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }
  }
  if (password !== confirmPassword) return { error: 'Las contraseñas no coinciden.' }

  // El nombre de usuario es único (sin distinguir mayúsculas). Si el servidor
  // no tiene la clave para consultarlo, lo frena igual el índice de la base.
  const taken = await emailForUsername(username)
  if (taken) return { error: 'Ese nombre de usuario ya está en uso.' }

  const supabase = await createClient()
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }, // El trigger de la base lo copia al perfil.
    },
  })

  if (error) {
    console.error('Error en el registro:', error)
    return { error: 'No se pudo completar el registro. Revisá los datos o probá con otro usuario.' }
  }

  // Si el proyecto pide confirmar el email, signUp no abre sesión: hay que
  // avisarlo en vez de mandar a un panel que va a rebotar al login.
  if (!data.session) {
    return { success: true, needsConfirmation: true }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
