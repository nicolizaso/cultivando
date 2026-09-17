'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/lib/supabase-server'

export async function login(formData: FormData) {
  const supabase = await createClient()
  
  const loginInput = formData.get('email') as string
  const password = formData.get('password') as string

  let email = loginInput

  // 1. Detectar si es un Usuario (si no tiene @)
  if (!loginInput.includes('@')) {
    // Resolvemos usuario -> email con una función de la base en vez de leer
    // 'profiles': esa tabla ya no es legible sin sesión, y acá todavía no la hay.
    // La función compara sin distinguir mayúsculas y devuelve un solo email.
    const { data: resolvedEmail } = await supabase
      .rpc('email_for_username', { p_username: loginInput })

    // Si no existe el perfil, usamos un email ficticio para continuar el flujo
    // y evitar ataques de tiempo o enumeración simple.
    email = resolvedEmail || 'non-existent-user@example.com'
  }

  // 2. Login con el email (el ingresado o el que encontramos por usuario)
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Credenciales inválidas.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const username = formData.get('username') as string

  // Validaciones
  if (!email || !password || !username) return { error: 'Todos los campos son obligatorios.' }
  if (password !== confirmPassword) return { error: 'Las contraseñas no coinciden.' }
  if (password.length < 6) return { error: 'Mínimo 6 caracteres para la contraseña.' }

  // Crear usuario
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }, // Guardamos en metadata para el trigger
    },
  })

  if (error) {
    return { error: 'No se pudo completar el registro. Por favor, verifica tus datos.' }
  }

  // Auto-Login post registro
  if (data.user) {
    await supabase.auth.signInWithPassword({
      email,
      password,
    })
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