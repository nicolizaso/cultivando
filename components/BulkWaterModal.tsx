"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Calculator, Droplets, Loader2 } from "lucide-react";

import { bulkWaterPlants } from "@/app/actions/plants";
import { getFertilizerCombos, getFertilizers } from "@/app/actions/fertilizers";
import { plantCountLabel, todayForInput } from "@/app/lib/utils";
import { recipeItems } from "@/app/lib/nutrition";
import type { ComboInfo, FertilizerDoseInfo, NutritionSelection } from "@/app/lib/nutrition";
import { describeDoses, doseForLiters, ecToPpm } from "@/app/lib/watering";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

interface BulkWaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  /** Para limpiar la selección después. */
  onSuccess: () => void;
  /** Semana de la etapa con la que arranca la calculadora de dosis. */
  defaultWeek?: number;
}

const EMPTY = { liters_total: "", ph: "", ec: "", runoff_ph: "", runoff_ec: "", water_temp: "" };

/**
 * Registrar un riego, con los datos que importan: litros, pH y EC (y el
 * drenaje, si se mide). La calculadora dice cuántos ml de cada producto van
 * para esos litros y lo deja anotado en la nota.
 */
export default function BulkWaterModal({ isOpen, onClose, selectedIds, onSuccess, defaultWeek = 1 }: BulkWaterModalProps) {
  const { showToast } = useToast();
  const id = useId();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(todayForInput);
  const [values, setValues] = useState(EMPTY);
  const [showRunoff, setShowRunoff] = useState(false);
  const [nutrients, setNutrients] = useState("");

  // Calculadora: los productos se piden la primera vez que se abre.
  const [showCalculator, setShowCalculator] = useState(false);
  const [fertilizers, setFertilizers] = useState<FertilizerDoseInfo[]>([]);
  const [combos, setCombos] = useState<(ComboInfo & { name: string })[]>([]);
  const [selection, setSelection] = useState<string>("");
  // null = la semana que propone quien abre el modal (cambia con la selección).
  const [weekInput, setWeekInput] = useState<string | null>(null);
  const [deductStock, setDeductStock] = useState(true);
  const week = weekInput ?? String(defaultWeek);
  const loaded = useRef(false);

  const set = (field: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }));

  const openCalculator = async () => {
    setShowCalculator((open) => !open);
    if (loaded.current) return;
    loaded.current = true;
    const [fertRes, comboRes] = await Promise.all([getFertilizers(), getFertilizerCombos()]);
    if (fertRes.data) setFertilizers(fertRes.data);
    if (comboRes.data) setCombos(comboRes.data.map((combo) => ({ id: combo.id, name: combo.name, products: combo.products })));
  };

  const liters = Number(values.liters_total.replace(",", ".")) || 0;
  const weekNumber = Math.max(1, Math.floor(Number(week) || 1));

  const doses = useMemo(() => {
    if (!selection) return [];
    const [type, rawId] = selection.split(":");
    const choice: NutritionSelection = { type: type === "combo" ? "combo" : "product", id: Number(rawId) };
    return doseForLiters(recipeItems(choice, fertilizers, combos, weekNumber), liters);
  }, [selection, fertilizers, combos, weekNumber, liters]);

  const ecValue = Number(values.ec.replace(",", "."));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Lo que dice la calculadora sale del stock, si se pidió.
    const usage = showCalculator && deductStock && liters > 0
      ? doses.filter((line) => line.total !== null).map((line) => ({ fertilizer_id: line.fertilizerId, ml: line.total }))
      : [];

    const res = await bulkWaterPlants(selectedIds, date, { nutrients, watering: values, usage });

    setLoading(false);

    if (res.success) {
      const low = 'lowStock' in res ? res.lowStock ?? [] : [];
      showToast(
        `Riego registrado en ${plantCountLabel(res.count ?? selectedIds.length)}` +
          (low.length > 0 ? `. Queda poco: ${low.map((item) => `${item.name} (${item.stock_ml ?? 0} ml)`).join(', ')}.` : '')
      );
      setValues(EMPTY);
      setNutrients("");
      setWeekInput(null);
      onSuccess();
      onClose();
    } else {
      showToast(res.error || "No se pudo registrar el riego", "error");
    }
  };

  const numberInput = (field: keyof typeof EMPTY, label: string, placeholder: string, hint?: string) => (
    <div className="field">
      <label htmlFor={`${id}-${field}`} className="field-label">{label}</label>
      <input
        id={`${id}-${field}`}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        className="field-input"
        value={values[field]}
        onChange={set(field)}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar riego"
      description={`Se aplicará a ${plantCountLabel(selectedIds.length)}.`}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="bulk-water-form" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Droplets size={16} aria-hidden="true" />
            )}
            {loading ? "Registrando..." : "Registrar riego"}
          </button>
        </>
      }
    >
      <form id="bulk-water-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="field">
          <label htmlFor="bulk-water-date" className="field-label">Fecha</label>
          <input
            id="bulk-water-date"
            data-autofocus
            type="date"
            required
            className="field-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="field-hint">Es la que se muestra como último riego de cada planta.</p>
        </div>

        <fieldset className="space-y-3">
          <legend className="field-label mb-2">Datos del agua <span className="font-normal text-fg-muted">(opcionales)</span></legend>
          <div className="grid grid-cols-3 gap-3">
            {numberInput("liters_total", "Litros", "10", selectedIds.length > 1 ? "En total" : undefined)}
            {numberInput("ph", "pH", "6,2")}
            {numberInput("ec", "EC (mS/cm)", "1,4", Number.isFinite(ecValue) && ecValue > 0 ? `${ecToPpm(ecValue)} ppm` : undefined)}
          </div>
          {liters > 0 && selectedIds.length > 1 && (
            <p className="text-xs text-fg-muted">
              {(Math.round((liters / selectedIds.length) * 100) / 100).toLocaleString("es-AR")} L por planta
            </p>
          )}

          <button type="button" className="text-xs font-semibold text-[color:var(--brand-text)] hover:underline" onClick={() => setShowRunoff((v) => !v)} aria-expanded={showRunoff}>
            {showRunoff ? "Ocultar drenaje y temperatura" : "Agregar drenaje y temperatura del agua"}
          </button>
          {showRunoff && (
            <div className="grid grid-cols-3 gap-3">
              {numberInput("runoff_ph", "pH drenaje", "6,5")}
              {numberInput("runoff_ec", "EC drenaje", "1,8")}
              {numberInput("water_temp", "Agua (°C)", "20")}
            </div>
          )}
        </fieldset>

        <div className="rounded-[var(--radius-md)] border border-line p-3">
          <button type="button" onClick={openCalculator} className="flex w-full items-center gap-2 text-sm font-semibold text-fg" aria-expanded={showCalculator}>
            <Calculator size={16} className="text-[color:var(--brand-text)]" aria-hidden="true" />
            Calcular nutrientes para estos litros
          </button>

          {showCalculator && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <div className="field">
                  <label htmlFor={`${id}-product`} className="field-label">Producto o combo</label>
                  <select id={`${id}-product`} className="field-input" value={selection} onChange={(e) => setSelection(e.target.value)}>
                    <option value="">Elegir…</option>
                    {combos.length > 0 && (
                      <optgroup label="Combos">
                        {combos.map((combo) => (
                          <option key={`c${combo.id}`} value={`combo:${combo.id}`}>{combo.name}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Productos">
                      {fertilizers.map((fertilizer) => (
                        <option key={`p${fertilizer.id}`} value={`product:${fertilizer.id}`}>{fertilizer.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`${id}-week`} className="field-label">Semana</label>
                  <input id={`${id}-week`} type="number" min={1} max={30} className="field-input" value={week} onChange={(e) => setWeekInput(e.target.value)} />
                </div>
              </div>

              {doses.length > 0 && (
                <>
                  {liters <= 0 && <p className="text-xs text-fg-muted">Poné los litros arriba para ver el total de cada producto.</p>}
                  <ul className="space-y-1 text-sm">
                    {doses.map((line) => (
                      <li key={line.name} className="flex items-baseline justify-between gap-3">
                        <span className="text-fg">{line.name}</span>
                        <span className="mono text-fg">
                          {line.total !== null ? `${line.total.toLocaleString("es-AR")} ml` : "–"}
                          <span className="ml-1.5 text-xs text-fg-muted">
                            {line.perLiter !== null ? `${line.perLiter.toLocaleString("es-AR")} ml/L` : "sin dosis cargada"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {liters > 0 && doses.some((line) => line.total !== null) && (
                    <label className="flex items-center gap-2 text-sm text-fg">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[color:var(--brand)]"
                        checked={deductStock}
                        onChange={(e) => setDeductStock(e.target.checked)}
                      />
                      Descontar del stock al registrar
                    </label>
                  )}
                  {liters > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        const text = describeDoses(doses, liters, weekNumber);
                        setNutrients((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
                      }}
                    >
                      Anotar en la nota
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="bulk-water-nutrients" className="field-label">Nutrientes y notas</label>
          <textarea
            id="bulk-water-nutrients"
            rows={3}
            placeholder="Ej: Base A+B (2ml/L), CalMag"
            className="field-input resize-none"
            value={nutrients}
            onChange={(e) => setNutrients(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
