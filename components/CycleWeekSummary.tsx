import type { TimelineText } from "@/app/lib/cycle-week";

interface CycleWeekSummaryProps {
  text: TimelineText;
  /** Grande en la cabecera del ciclo, chico en la tarjeta del panel. */
  size?: "sm" | "lg";
}

/**
 * En qué momento está el ciclo: "Flora · semana 4 de ~8", el día y la cosecha
 * aproximada, con una barra del avance de la flora hacia la meta. Pasada la
 * meta la barra queda llena y el texto lo dice, sin colores de alarma: las
 * 8 semanas son una referencia, no un plazo.
 */
export default function CycleWeekSummary({ text, size = "sm" }: CycleWeekSummaryProps) {
  const large = size === "lg";
  return (
    <div className="min-w-0">
      <p className={`font-title font-semibold tracking-tight text-fg ${large ? "text-2xl sm:text-3xl" : "text-base"}`}>
        {text.headline}
      </p>
      {text.progress !== null && (
        <div
          className={`mt-2 overflow-hidden rounded-full bg-surface-2 ${large ? "h-2 max-w-sm" : "h-1.5"}`}
          role="progressbar"
          aria-label="Avance de la flora hacia la meta"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(text.progress * 100)}
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, text.progress * 100)}%` }} />
        </div>
      )}
      {text.detail && (
        <p className={`mt-1.5 text-fg-muted ${large ? "text-sm" : "text-xs"}`}>{text.detail}</p>
      )}
    </div>
  );
}
