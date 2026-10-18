'use client'

import { useState } from 'react'
import { Check, Copy, Link2, Loader2, Share2 } from 'lucide-react'
import { getOrCreateCycleShare, revokeCycleShare } from '@/app/actions/shares'
import { useToast } from '@/app/context/ToastContext'
import Modal from '@/components/ui/Modal'

/**
 * Compartir el ciclo con un enlace de sólo lectura: quien lo abre ve el
 * resumen, las plantas, el clima y las fotos, sin cuenta y sin poder tocar
 * nada. El enlace se puede cortar cuando se quiera.
 */
export default function ShareCycleButton({ cycleId, cycleName }: { cycleId: number; cycleName: string }) {
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const open = async () => {
    setIsOpen(true)
    setCopied(false)
    if (url) return
    setLoading(true)
    const res = await getOrCreateCycleShare(cycleId)
    setLoading(false)
    if (res.error || !res.token) {
      showToast(res.error || 'No se pudo crear el enlace.', 'error')
      setIsOpen(false)
      return
    }
    setUrl(`${window.location.origin}/compartido/${res.token}`)
  }

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      showToast('No se pudo copiar: seleccioná el enlace y copialo a mano.', 'error')
    }
  }

  const shareNative = async () => {
    if (!url || !navigator.share) return
    try {
      await navigator.share({ title: cycleName, url })
    } catch {
      // Cerrar el diálogo de compartir no es un error.
    }
  }

  const revoke = async () => {
    setLoading(true)
    const res = await revokeCycleShare(cycleId)
    setLoading(false)
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    setUrl(null)
    setIsOpen(false)
    showToast('Enlace cortado: ya nadie puede verlo.')
  }

  const canShareNative = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <>
      <button type="button" className="btn btn-sm btn-ghost" onClick={open}>
        <Share2 size={15} aria-hidden="true" />
        Compartir
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Compartir el ciclo"
        description="Quien tenga el enlace ve el resumen, las plantas, el clima, la cosecha y las fotos. No ve la bitácora ni puede cambiar nada."
        size="sm"
        footer={
          <>
            {url && (
              <button type="button" className="btn btn-ghost mr-auto text-[color:var(--danger)]" onClick={revoke} disabled={loading}>
                Cortar enlace
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setIsOpen(false)}>Listo</button>
          </>
        }
      >
        {loading && !url ? (
          <p className="flex items-center gap-2 py-4 text-sm text-fg-muted">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Creando el enlace…
          </p>
        ) : url ? (
          <div className="space-y-3">
            <label htmlFor="share-url" className="field-label flex items-center gap-1.5">
              <Link2 size={14} aria-hidden="true" /> Enlace
            </label>
            <input id="share-url" readOnly className="field-input text-sm" value={url} onFocus={(e) => e.target.select()} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm btn-secondary" onClick={copy}>
                {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              {canShareNative && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={shareNative}>
                  <Share2 size={15} aria-hidden="true" /> Enviar
                </button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
