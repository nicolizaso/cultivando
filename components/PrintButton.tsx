'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button type="button" className="btn btn-sm btn-secondary" onClick={() => window.print()}>
      <Printer size={15} aria-hidden="true" />
      Imprimir o guardar PDF
    </button>
  )
}
