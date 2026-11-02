"use client";

import { useMemo, useRef, useState } from "react";
import { Calculator, Droplets, NotebookPen } from "lucide-react";

import { bulkWaterPlants } from "@/app/actions/plants";
import { getFertilizerCombos, getFertilizers } from "@/app/actions/fertilizers";
import { plantCountLabel, todayForInput } from "@/app/lib/utils";
import { recipeItems } from "@/app/lib/nutrition";
import type { ComboInfo, FertilizerDoseInfo, NutritionSelection } from "@/app/lib/nutrition";
import { describeDoses, doseForLiters, ecToPpm } from "@/app/lib/watering";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import { DateField, Disclosure, Field, FormActions, FormSection, Input, Select, Stepper, Switch, Textarea } from "@/components/ui/form";

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
  const [productsState, setProductsState] = useState<"idle" | "loading" | "ready">("idle");

  const set = (field: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }));

  const openCalculator = async () => {
    setShowCalculator((open) => !open);
    if (loaded.current) return;
    loaded.current = true;
    setProductsState("loading");
    const [fertRes, comboRes] = await Promise.all([getFertilizers(), getFertilizerCombos()]);
    if (fertRes.data) setFertilizers(fertRes.data);
    if (comboRes.data) setCombos(comboRes.data.map((combo) => ({ id: combo.id, name: combo.name, products: combo.products })));
    setProductsState("ready");
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

  const numberInput = (field: keyof typeof EMPTY, label: string, placeholder: string, suffix?: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        suffix={suffix}
        value={values[field]}
        onChange={set(field)}
      />
    </Field>
  );

  const perPlant = liters > 0 && selectedIds.length > 1
    ? `${(Math.round((liters / selectedIds.length) * 100) / 100).toLocaleString("es-AR")} L por planta`
    : undefined;

  const runoffSummary = [
    values.runoff_ph && `pH ${values.runoff_ph}`,
    values.runoff_ec && `EC ${values.runoff_ec}`,
    values.water_temp && `${values.water_temp} °C`,
  ].filter(Boolean).join(", ");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar riego"
      description={`Para ${plantCountLabel(selectedIds.length)}.`}
      footer={
        <FormActions
          form="bulk-water-form"
          onCancel={onClose}
          icon={Droplets}
          pending={loading}
          pendingLabel="Registrando…"
          submitLabel="Registrar riego"
        />
      }
    >
      <form id="bulk-water-form" onSubmit={handleSubmit} className="space-y-6">
        <DateField
          label="Cuándo"
          value={date}
          onChange={setDate}
          hint="Queda como último riego de cada planta."
        />

        <FormSection title="El agua" description="Todo opcional: anotá lo que midas.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {numberInput("liters_total", selectedIds.length > 1 ? "Litros en total" : "Litros", "10", "L", perPlant)}
            {numberInput("ph", "pH", "6,2")}
            <div className="col-span-2 sm:col-span-1">
              {numberInput("ec", "EC", "1,4", "mS/cm", Number.isFinite(ecValue) && ecValue > 0 ? `${ecToPpm(ecValue)} ppm` : undefined)}
            </div>
          </div>

          <Disclosure
            label="Drenaje y temperatura"
            summary={runoffSummary || "Lo que sale por abajo de la maceta"}
            open={showRunoff}
            onOpenChange={setShowRunoff}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {numberInput("runoff_ph", "pH drenaje", "6,5")}
              {numberInput("runoff_ec", "EC drenaje", "1,8")}
              <div className="col-span-2 sm:col-span-1">{numberInput("water_temp", "Temp. del agua", "20", "°C")}</div>
            </div>
          </Disclosure>
        </FormSection>

        <Disclosure
          label="Calcular nutrientes"
          summary={liters > 0 ? `Cuántos ml de cada producto para ${liters.toLocaleString("es-AR")} L` : "Cuántos ml de cada producto van"}
          icon={<Calculator size={18} />}
          open={showCalculator}
          onOpenChange={() => { openCalculator(); }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
            <Field label="Producto o combo">
              <Select value={selection} onChange={(e) => setSelection(e.target.value)}>
                <option value="">{productsState === "loading" ? "Cargando productos…" : productsState === "ready" && fertilizers.length + combos.length === 0 ? "No hay productos cargados" : "Elegir…"}</option>
                {combos.length > 0 && (
                  <optgroup label="Combos">
                    {combos.map((combo) => (
                      <option key={`c${combo.id}`} value={`combo:${combo.id}`}>{combo.name}</option>
                    ))}
                  </optgroup>
                )}
                {fertilizers.length > 0 && (
                  <optgroup label="Productos">
                    {fertilizers.map((fertilizer) => (
                      <option key={`p${fertilizer.id}`} value={`product:${fertilizer.id}`}>{fertilizer.name}</option>
                    ))}
                  </optgroup>
                )}
              </Select>
            </Field>
            <Field label="Semana de la etapa">
              <Stepper
                value={weekNumber}
                onChange={(n) => setWeekInput(String(n))}
                min={1}
                max={30}
                unitName="semana"
              />
            </Field>
          </div>

          {doses.length > 0 && (
            <div className="space-y-3">
              {liters <= 0 && <p className="field-hint">Cargá los litros arriba para ver el total de cada producto.</p>}
              <ul className="divide-y divide-[color:var(--border)] rounded-[var(--radius-md)] border border-line bg-surface-2 text-sm">
                {doses.map((line) => (
                  <li key={line.name} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0 truncate text-fg">{line.name}</span>
                    <span className="shrink-0 text-right">
                      <span className="mono font-semibold text-fg">
                        {line.total !== null ? `${line.total.toLocaleString("es-AR")} ml` : "–"}
                      </span>
                      <span className="block text-xs text-fg-muted">
                        {line.perLiter !== null ? `${line.perLiter.toLocaleString("es-AR")} ml/L` : "sin dosis cargada"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {liters > 0 && doses.some((line) => line.total !== null) && (
                <Switch
                  checked={deductStock}
                  onChange={setDeductStock}
                  label="Descontar del stock"
                  description="Resta estos ml de cada producto al registrar el riego."
                />
              )}
              {liters > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary w-full"
                  onClick={() => {
                    const text = describeDoses(doses, liters, weekNumber);
                    setNutrients((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
                  }}
                >
                  <NotebookPen size={15} aria-hidden="true" />
                  Copiar la receta a la nota
                </button>
              )}
            </div>
          )}
        </Disclosure>

        <Field label="Nutrientes y notas" optional>
          <Textarea
            placeholder="Ej: Base A+B (2 ml/L), CalMag"
            value={nutrients}
            onChange={(e) => setNutrients(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
