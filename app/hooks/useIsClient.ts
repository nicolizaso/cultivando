'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * true en el navegador ya hidratado, false en el servidor y durante la
 * hidratación. Sirve para lo que depende del cliente (el tema elegido, un
 * portal al `document`, la hora actual) sin que el HTML del servidor y el del
 * primer render difieran.
 *
 * Reemplaza el patrón `useEffect(() => setMounted(true), [])`, que hacía un
 * render extra en cada componente que lo usaba.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
