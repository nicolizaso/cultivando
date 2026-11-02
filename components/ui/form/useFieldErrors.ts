'use client'

import { useCallback, useState } from 'react'

type Rules<K extends string> = Partial<Record<K, string | false | null | undefined>>

/**
 * Errores por campo. `validate` recibe, por campo, el mensaje si está mal (o
 * algo falso si está bien), los guarda y lleva el foco al primer campo
 * marcado. Cada campo limpia su error al cambiar.
 */
export function useFieldErrors<K extends string>() {
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({})

  const validate = useCallback((rules: Rules<K>, root?: HTMLElement | null) => {
    const next: Partial<Record<K, string>> = {}
    for (const key of Object.keys(rules) as K[]) {
      const message = rules[key]
      if (typeof message === 'string' && message) next[key] = message
    }
    setErrors(next)
    const ok = Object.keys(next).length === 0
    if (!ok) focusFirstInvalid(root)
    return ok
  }, [])

  const clear = useCallback((key: K) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const set = useCallback((key: K, message: string) => {
    setErrors((prev) => ({ ...prev, [key]: message }))
  }, [])

  return { errors, validate, clear, set, reset: () => setErrors({}) }
}

/** Lleva el foco (y la vista) al primer control marcado como inválido. */
export function focusFirstInvalid(root?: HTMLElement | null) {
  requestAnimationFrame(() => {
    const scope: ParentNode = root ?? document
    const invalid = scope.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (!invalid) return
    const target = invalid.matches('input, select, textarea, button')
      ? invalid
      : invalid.querySelector<HTMLElement>('input:not([disabled]), select, textarea, button')
    target?.focus({ preventScroll: true })
    invalid.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}
