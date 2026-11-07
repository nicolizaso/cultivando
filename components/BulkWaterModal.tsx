"use client";

import { useState } from "react";
import { FlaskConical, Droplets, Package } from "lucide-react";

import { bulkWaterPlants } from "@/app/actions/plants";
import { plantCountLabel, todayForInput } from "@/app/lib/utils";
import { mixLabel, mixUsage, resolveMix, stageDaysForWeek } from "@/app/lib/nutrition";
import type { MixItem } from "@/app/lib/nutrition";
import { parseDecimal } from "@/app/lib/sanitize";
import { ecToPpm } from "@/app/lib/watering";
import Modal from "@/components/ui/Modal";
import NutrientPicker, { useNutritionOptions } from "@/components/NutrientPicker";
import { useToast } from "@/app/context/ToastContext";
import { DateField, Disclosure, Field, FormActions, FormSection, Input, Switch, Textarea } from "@/components/ui/form";

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
 * drenaje, si se mide). Si lleva nutrientes, se eligen con el mismo selector
 * de las tareas: dice cuánto va de cada producto para esos litros, queda en
 * la bitácora de cada planta y, si se pide, sale del stock.
 */
export default function BulkWaterModal({ isOpen, onClose, selectedIds, onSuccess, defaultWeek = 1 }: BulkWaterModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(todayForInput);
  const [values, setValues] = useState(EMPTY);
  const [showRunoff, setShowRunoff] = useState(false);
  const [nutrients, setNutrients] = useState("");

  // Nutrientes: los productos se piden la primera vez que se abre la sección.
  const [showNutrients, setShowNutrients] = useState(false);
  const nutrition = useNutritionOptions();
  const [mix, setMix] = useState<MixItem[]>([]);
  // null = la semana que propone quien abre el modal.
  const [weekInput, setWeekInput] = useState<number | null>(null);
  const [deductStock, setDeductStock] = useState(true);
  const week = weekInput ?? Math.max(1, defaultWeek);

  const set = (field: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }));

  const parsedLiters = parseDecimal(values.liters_total);
  const liters = parsedLiters !== undefined && Number.isFinite(parsedLiters) && parsedLiters > 0 ? parsedLiters : 0;
  const fertilizers = nutrition.options?.fertilizers ?? [];
  const usage = mixUsage(resolveMix(mix, fertilizers, week), liters, selectedIds.length);
  const canDeduct = usage.some((line) =>
    line.total !== null && fertilizers.find((product) => product.id === line.fertilizer_id)?.stock_ml != null
  );

  const ecValue = parseDecimal(values.ec) ?? NaN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await bulkWaterPlants(selectedIds, date, {
      nutrients,
      watering: values,
      // La mezcla como datos: el servidor calcula las dosis con tus productos.
      feed: mix.length > 0 ? { items: mix, stage_days: stageDaysForWeek(week) } : null,
      deductStock: canDeduct && deductStock,
    });

    setLoading(false);

    if (res.success) {
      const low = 'lowStock' in res ? res.lowStock ?? [] : [];
      showToast(
        `Riego registrado en ${plantCountLabel(res.count ?? selectedIds.length)}` +
          (low.length > 0 ? `. Queda poco: ${low.map((item) => `${item.name} (${(item.stock_ml ?? 0).toLocaleString('es-AR')})`).join(', ')}.` : '')
      );
      setValues(EMPTY);
      setNutrients("");
      setMix([]);
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
          label="Nutrientes"
          summary={mix.length > 0 ? mixLabel(mix, nutrition.options?.combos ?? []) : "Qué lleva el agua y cuánto de cada producto"}
          icon={<FlaskConical size={18} />}
          open={showNutrients}
          onOpenChange={(open) => { setShowNutrients(open); if (open) nutrition.load(); }}
        >
          <NutrientPicker
            options={nutrition.options}
            state={nutrition.state}
            onReload={nutrition.reload}
            value={mix}
            onChange={setMix}
            week={week}
            onWeekChange={setWeekInput}
            liters={liters}
            plantCount={selectedIds.length}
            legend="Qué lleva"
            hint={liters > 0 ? undefined : "Cargá los litros arriba para ver cuánto va de cada producto."}
          />
          {canDeduct && (
            <Switch
              checked={deductStock}
              onChange={setDeductStock}
              icon={<Package size={17} />}
              label="Descontar del stock"
              description="Resta lo usado de cada producto al registrar el riego."
            />
          )}
        </Disclosure>

        <Field label="Notas" optional>
          <Textarea
            placeholder="Ej: agua de lluvia, regué lento"
            value={nutrients}
            onChange={(e) => setNutrients(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
