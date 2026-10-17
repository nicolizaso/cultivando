import { createClient } from "@/app/lib/supabase-server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Calendar, Droplets, History, Pencil, Sprout } from "lucide-react";

import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import LogModal from "@/components/LogModal";
import PlantMetricsDisplay from "@/components/PlantMetricsDisplay";
import TimelineSection, { TimelineItem } from "@/components/TimelineSection";
import { getPlantMetrics, getStageColor, getWaterStatus } from "@/app/lib/utils";
import { canonicalLogType } from "@/app/lib/logs";
import { getTaskType } from "@/app/lib/constants";
import { parseId } from "@/app/lib/sanitize";
import { taskAppliesToPlant } from "@/app/lib/task-effects";
import { ancestors, descendants, lineageStats } from "@/app/lib/lineage";
import type { LineagePlant } from "@/app/lib/lineage";
import LineageSection from "@/components/LineageSection";

interface TaskRow {
  id: number;
  title: string;
  type: string | null;
  status: string | null;
  due_date: string;
  completed_at: string | null;
  description: string | null;
  metadata: unknown;
  task_plants: { plant_id: number }[] | null;
}

const TASK_COLUMNS = 'id, title, type, status, due_date, completed_at, description, metadata, task_plants ( plant_id )';

export default async function PlantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) return notFound();

  const { data: plant, error } = await supabase
    .from('plants')
    .select(`*, cycles ( id, name )`)
    .eq('id', id)
    .single();

  if (error || !plant) return notFound();

  // La bitácora de la planta y lo que se anotó para todo su ciclo (mudanzas).
  const logsQuery = plant.cycle_id
    ? supabase
        .from('logs')
        .select('*')
        .or(`plant_id.eq.${id},and(cycle_id.eq.${Number(plant.cycle_id)},plant_id.is.null)`)
        .order('created_at', { ascending: false })
    : supabase.from('logs').select('*').eq('plant_id', id).order('created_at', { ascending: false });

  // Tareas enlazadas a la planta o a su ciclo; después se queda sólo con las
  // que de verdad le tocan (ver `taskAppliesToPlant`). Antes se buscaban
  // además por un `space_id` que las plantas no tienen.
  const linkedTasksQuery = supabase
    .from('tasks')
    .select(`${TASK_COLUMNS}, linked:task_plants!inner ( plant_id )`)
    .eq('linked.plant_id', id);

  const cycleTasksQuery = plant.cycle_id
    ? supabase
        .from('tasks')
        .select(`${TASK_COLUMNS}, linked:task_cycles!inner ( cycle_id )`)
        .eq('linked.cycle_id', Number(plant.cycle_id))
    : Promise.resolve({ data: [] as TaskRow[] });

  const imagesQuery = plant.cycle_id
    ? supabase
        .from('cycle_images')
        .select('*')
        .eq('cycle_id', Number(plant.cycle_id))
        .order('taken_at', { ascending: false })
    : Promise.resolve({ data: [] as { id: string; taken_at: string | null; created_at: string | null; description: string | null; public_url: string }[] });

  // Para el linaje: todas las plantas, sólo lo necesario para armar el árbol.
  const lineageQuery = supabase
    .from('plants')
    .select('id, name, mother_id, stage, is_archived, is_mother, planted_at');

  const [logsResult, linkedTasksResult, cycleTasksResult, imagesResult, lineageResult] = await Promise.all([
    logsQuery,
    linkedTasksQuery,
    cycleTasksQuery,
    imagesQuery,
    lineageQuery,
  ]);

  const lineagePlants = (lineageResult.data ?? []) as LineagePlant[];
  const lineageSelf = lineagePlants.find((p) => p.id === id) ?? { id, name: plant.name, mother_id: plant.mother_id, is_mother: plant.is_mother };

  const logs = logsResult.data || [];
  const cycleImages = imagesResult.data || [];

  const tasksById = new Map<number, TaskRow>();
  for (const task of [...(linkedTasksResult.data ?? []), ...(cycleTasksResult.data ?? [])] as TaskRow[]) {
    if (taskAppliesToPlant(task, { id, cycle_id: plant.cycle_id })) tasksById.set(Number(task.id), task);
  }
  const uniqueTasks = Array.from(tasksById.values());

  const pendingTasksList = uniqueTasks.filter((t) => t.status === 'pending');
  const completedTasksList = uniqueTasks.filter((t) => t.status !== 'pending');

  const pendingTimelineItems: TimelineItem[] = pendingTasksList.map((task) => ({
    id: `task-${task.id}`,
    originalId: task.id,
    date: task.due_date,
    title: task.title,
    type: task.type ?? 'otro',
    notes: task.description ?? undefined,
    isTask: true,
    status: 'pending'
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Toda la bitácora: notas, riegos, cambios de etapa, archivados y fotos.
  // Antes sólo se mostraban las fotos y el resto quedaba guardado sin verse.
  const historyTimelineItems: TimelineItem[] = [
    ...logs.map((log) => ({
      id: `log-${log.id}`,
      originalId: log.id,
      date: log.created_at ?? '',
      title: log.title || getTaskType(log.type).label,
      type: canonicalLogType(log.type) || 'log',
      notes: log.notes ?? undefined,
      media_url: log.media_url ?? undefined,
      isTask: false,
      status: 'completed'
    })),
    ...completedTasksList.map((task) => ({
      id: `task-${task.id}`,
      originalId: task.id,
      date: task.completed_at || task.due_date,
      title: task.title,
      type: task.type ?? 'otro',
      notes: task.description ?? undefined,
      isTask: true,
      status: 'completed'
    })),
    ...cycleImages.map((img) => ({
      id: `img-${img.id}`,
      originalId: img.id,
      date: img.taken_at ?? img.created_at ?? '',
      title: 'Foto de ciclo',
      type: 'image',
      notes: img.description ?? undefined,
      media_url: [img.public_url],
      isTask: false,
      status: 'completed'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const { currentStage } = getPlantMetrics(plant);
  const rawStage = currentStage || plant.stage || '';
  const displayStage = (rawStage === 'Esqueje' || rawStage === 'Plántula') ? 'Plántula' : rawStage;
  const stageInfo = getStageColor(displayStage);
  const water = getWaterStatus(plant.last_water);

  // El atraso de riego se marca con icono y texto, no sólo con color.
  const waterTone = {
    late: 'text-[color:var(--danger)]',
    warn: 'text-[color:var(--warning)]',
    ok: 'text-fg',
    unknown: 'text-fg-muted',
  }[water.level];

  return (
    <PageShell>
      <PageHeader
        title={plant.name}
        backHref="/plants"
        backLabel="Plantas"
        subtitle={plant.strain || 'Genética sin cargar'}
        actions={
          <>
            <LogModal plantId={plant.id} plantName={plant.name} />
            <Link href={`/plants/${plant.id}/edit`} className="btn btn-secondary">
              <Pencil size={16} aria-hidden="true" />
              Editar
            </Link>
          </>
        }
      />

      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="surface relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] lg:col-span-3 lg:aspect-[16/10]">
          {plant.image_url ? (
            <Image
              src={plant.image_url}
              alt={`Foto de ${plant.name}`}
              fill
              sizes="(min-width: 1024px) 720px, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className={`flex h-full flex-col items-center justify-center gap-2 ${stageInfo.bgColor} ${stageInfo.textColor}`}>
              <Sprout size={44} strokeWidth={1.5} aria-hidden="true" />
              <p className="text-xs font-semibold">Sin foto todavía</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
              {stageInfo.icon}
              {displayStage}
            </span>
            {plant.is_mother && <span className="chip chip-brand">Planta madre</span>}
            {plant.cycles?.name && (
              <Link href={`/cycles/${plant.cycles.id}`} className="chip chip-neutral transition-colors hover:text-fg">
                {plant.cycles.name}
              </Link>
            )}
          </div>

          {/* Las tres métricas comparten tratamiento. Antes cada una llevaba el
              suyo (neutra, teñida por etapa y teñida por riego) y la ficha
              parecía tres componentes distintos pegados. */}
          <dl className="grid grid-cols-2 gap-3">
            <div className="surface rounded-[var(--radius-lg)] p-4">
              <dt className="metric-label flex items-center gap-1.5">
                <Calendar size={13} aria-hidden="true" />
                Edad total
              </dt>
              <dd className="metric mt-2 text-2xl text-fg">
                <PlantMetricsDisplay plant={plant} type="totalAge" />
                <span className="ml-1 text-sm font-medium text-fg-muted">días</span>
              </dd>
            </div>

            <div className="surface rounded-[var(--radius-lg)] p-4">
              <dt className="metric-label flex items-center gap-1.5">
                <History size={13} aria-hidden="true" />
                En {displayStage.toLowerCase()}
              </dt>
              <dd className="metric mt-2 text-2xl text-fg">
                <PlantMetricsDisplay plant={plant} type="daysInCurrentStage" />
                <span className="ml-1 text-sm font-medium text-fg-muted">días</span>
              </dd>
            </div>

            <div className="surface col-span-2 rounded-[var(--radius-lg)] p-4">
              <dt className="metric-label flex items-center gap-1.5">
                <Droplets size={13} aria-hidden="true" />
                Último riego
              </dt>
              <dd className={`mt-2 flex items-center gap-1.5 font-title text-xl font-semibold ${waterTone}`}>
                {water.level === 'late' && <AlertTriangle size={17} aria-hidden="true" />}
                {water.label}
              </dd>
              {water.level === 'late' && (
                <p className="mt-1 text-xs text-[color:var(--danger)]">Lleva demasiados días sin agua.</p>
              )}
            </div>
          </dl>
        </div>
      </div>

      <LineageSection
        plant={lineageSelf}
        ancestors={ancestors(id, lineagePlants)}
        tree={descendants(id, lineagePlants)}
        stats={lineageStats(id, lineagePlants)}
      />

      <section aria-labelledby="bitacora" className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2.5 border-b border-line pb-4">
          <History className="text-[color:var(--brand-text)]" size={18} aria-hidden="true" />
          <h2 id="bitacora" className="section-title">Bitácora de seguimiento</h2>
        </div>

        <TimelineSection
          pendingTasks={pendingTimelineItems}
          historyItems={historyTimelineItems}
        />
      </section>
    </PageShell>
  );
}
