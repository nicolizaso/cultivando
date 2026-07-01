'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'

interface DatePickerProps {
  selectedDate: string // YYYY-MM-DD
  onChange: (date: string) => void
}

export default function DatePicker({ selectedDate, onChange }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  // Sincronizar mes visual
  useEffect(() => {
    if (selectedDate) setCurrentMonth(new Date(selectedDate))
  }, [selectedDate])

  // Calcular posición al abrir
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // Si estamos muy abajo en la pantalla, abrir hacia arriba (opcional, por ahora simple hacia abajo)
      setPosition({
        top: rect.bottom + 8, // 8px de margen abajo del input
        left: rect.left
      })
    }
  }, [isOpen])

  // Cerrar al scrollear para que no quede flotando en el aire
  useEffect(() => {
    const handleScroll = () => { if(isOpen) setIsOpen(false) }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isOpen])

  const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

  const handleDayClick = (day: number) => {
    const year = currentMonth.getFullYear()
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    onChange(`${year}-${month}-${dayStr}`)
    setIsOpen(false)
  }

  // Generación de días
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const daysArray = []
  
  for (let i = 0; i < firstDay; i++) daysArray.push(<div key={`empty-${i}`} className="h-8 w-8" />)
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isSelected = selectedDate === dateStr
    const isToday = new Date().toISOString().split('T')[0] === dateStr

    daysArray.push(
      <button
        key={d}
        onClick={(e) => { e.stopPropagation(); handleDayClick(d); }}
        className={`h-8 w-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
          isSelected 
            ? 'bg-brand-primary text-white shadow-[0_0_10px_rgba(0,165,153,0.4)] scale-110'
            : isToday 
              ? 'border border-brand-primary text-brand-primary' 
              : 'text-foreground hover:bg-card-border'
        }`}
      >
        {d}
      </button>
    )
  }

  return (
    <>
      {/* Input Trigger (Referencia para posicionar) */}
      <div 
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-background border border-card-border rounded-xl py-3 px-3 flex items-center justify-between cursor-pointer hover:border-brand-primary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <CalendarIcon className="text-muted" size={18} />
          <span className="text-foreground text-sm font-bold">
            {selectedDate.split('-').reverse().join('/')}
          </span>
        </div>
      </div>

      {/* Dropdown Flotante (Portal-like behavior via fixed) */}
      {isOpen && (
        <>
          {/* Overlay invisible para cerrar al hacer clic afuera */}
          <div className="fixed inset-0 z-60" onClick={() => setIsOpen(false)} />
          
          <div 
            className="fixed bg-card border border-card-border rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-4 z-70 animate-in zoom-in-95 duration-200 w-[280px]"
            style={{ top: position.top, left: position.left }}
          >
            {/* Header Calendario */}
            <div className="flex justify-between items-center mb-4">
              <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(new Date(year, month - 1, 1)); }} className="p-1 hover:bg-card-border rounded-full text-muted hover:text-foreground">
                <ChevronLeft size={20} />
              </button>
              <span className="text-foreground font-bold capitalize text-sm">
                {MONTHS[month]} {year}
              </span>
              <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(new Date(year, month + 1, 1)); }} className="p-1 hover:bg-card-border rounded-full text-muted hover:text-foreground">
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Grid Días */}
            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
              {DAYS.map(d => <span key={d} className="text-[10px] uppercase font-bold text-muted">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1 place-items-center">
              {daysArray}
            </div>
          </div>
        </>
      )}
    </>
  )
}