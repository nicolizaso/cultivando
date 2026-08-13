import { createClient } from "@/app/lib/supabase-server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import GlobalHeader from "@/components/GlobalHeader";
import LogModal from "@/components/LogModal";
import PlantMetricsDisplay from "@/components/PlantMetricsDisplay";
import TimelineSection, { TimelineItem } from "@/components/TimelineSection"; // Updated import
import { getPlantMetrics, getStageColor } from "@/app/lib/utils";
import { Calendar, Droplets, History, Sprout, Edit, AlertTriangle } from "lucide-react";

export default async function PlantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();

  const { data: plant, error } = await supabase
    .from('plants')
    .select(`*, current_age_days, days_in_stage, cycles ( name )`)
    .eq('id', id)
    .single();

  if (error || !plant) return notFound();

  // 1. Fetch logs
  let logsQuery = supabase
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (plant.cycle_id) {
     logsQuery = logsQuery.or(`plant_id.eq.${id},and(cycle_id.eq.${plant.cycle_id},plant_id.is.null)`);
  } else {
     logsQuery = logsQuery.eq('plant_id', id);
  }

  // 2. Fetch Tasks (Both Pending and Completed)
  // Space-based tasks
  const spaceTasksQuery = supabase
    .from('tasks')
    .select('*')
    .eq('space_id', plant.space_id);

  // Linked tasks
  const linkedTasksQuery = supabase
    .from('tasks')
    .select('*, task_plants!inner(plant_id)')
    .eq('task_plants.plant_id', id);

  // 3. Fetch Cycle Images (if cycle exists)
  let imagesQuery: any = Promise.resolve({ data: [] });
  if (plant.cycle_id) {
    imagesQuery = supabase
      .from('cycle_images')
      .select('*')
      .eq('cycle_id', plant.cycle_id)
      .order('taken_at', { ascending: false });
  }

  const [logsResult, spaceTasksResult, linkedTasksResult, imagesResult] = await Promise.all([
    logsQuery,
    spaceTasksQuery,
    linkedTasksQuery,
    imagesQuery
  ]);

  const logs = logsResult.data || [];
  const spaceTasks = spaceTasksResult.data || [];
  const linkedTasks = linkedTasksResult.data || [];
  const cycleImages = imagesResult.data || [];

  // Deduplicate tasks
  const allTasksRaw = [...spaceTasks, ...linkedTasks];
  const uniqueTasksMap = new Map();
  // @ts-ignore
  allTasksRaw.forEach((t: any) => uniqueTasksMap.set(t.id, t));
  const uniqueTasks = Array.from(uniqueTasksMap.values());

  // Split Tasks
  // @ts-ignore
  const pendingTasksList = uniqueTasks.filter((t: any) => t.status === 'pending');
  // @ts-ignore
  const completedTasksList = uniqueTasks.filter((t: any) => t.status !== 'pending'); // Assuming 'completed' or others are history

  // Map to TimelineItem
  const pendingTimelineItems: TimelineItem[] = pendingTasksList.map((task: any) => ({
    id: `task-${task.id}`,
    originalId: task.id,
    date: task.due_date,
    title: task.title,
    type: task.type,
    notes: task.description,
    isTask: true,
    status: 'pending'
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // ASC for pending

  const historyTimelineItems: TimelineItem[] = [
    // Logs (Only photos)
    ...logs.filter((log: any) => log.type === 'foto').map((log: any) => ({
      id: `log-${log.id}`,
      originalId: log.id,
      date: log.created_at,
      title: log.title,
      type: log.type || 'log',
      notes: log.notes,
      media_url: log.media_url,
      isTask: false,
      status: 'completed'
    })),
    // Completed Tasks
    ...completedTasksList.map((task: any) => ({
      id: `task-${task.id}`,
      originalId: task.id,
      date: task.completed_at || task.due_date,
      title: task.title,
      type: task.type,
      notes: task.description,
      isTask: true,
      status: 'completed'
    })),
    // Cycle Images
    ...cycleImages.map((img: any) => ({
      id: `img-${img.id}`,
      originalId: img.id,
      date: img.taken_at,
      title: 'Foto de Ciclo',
      type: 'image',
      notes: img.description,
      media_url: [img.public_url],
      isTask: false,
      status: 'completed'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // DESC for history

  const { currentStage, daysInCurrentStage, totalAge } = getPlantMetrics(plant);
  const rawStage = currentStage || plant.stage;
  const displayStage = (rawStage === 'Esqueje' || rawStage === 'Plántula') ? 'Plántula' : rawStage;
  const stageInfo = getStageColor(displayStage);

  let daysSinceWater: number | null = null;
  if (plant.last_water) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastWaterDate = new Date(plant.last_water);
    lastWaterDate.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - lastWaterDate.getTime();
    daysSinceWater = Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  // El riego atrasado se marca por color y también por icono y texto: el
  // color por sí solo no comunica el estado a quien no lo distingue.
  let waterCardClasses = "border-line bg-surface";
  let waterTextClasses = "text-fg";
  if (daysSinceWater !== null) {
    if (daysSinceWater >= 4) {
      waterCardClasses = "border-[color:color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color:var(--danger-soft)]";
      waterTextClasses = "text-[color:var(--danger)]";
    } else if (daysSinceWater === 3) {
      waterCardClasses = "border-[color:color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color:var(--warning-soft)]";
      waterTextClasses = "text-[color:var(--warning)]";
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 md:py-8">
      <GlobalHeader userEmail={user?.email} title={plant.name} subtitle="Ficha de la planta" />

      <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="surface relative aspect-square overflow-hidden rounded-[var(--radius-lg)] md:aspect-video">
          {plant.image_url ? (
            <Image
              src={plant.image_url}
              alt={`Foto de ${plant.name}`}
              fill
              sizes="(min-width: 768px) 640px, 100vw"
              priority
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-fg-subtle">
              <Sprout size={56} aria-hidden="true" />
            </div>
          )}

          <Link
            href={`/plants/${plant.id}/edit`}
            className="btn btn-secondary absolute right-4 top-4 h-10 min-h-10 px-3 text-xs"
          >
            <Edit size={14} aria-hidden="true" />
            Editar
          </Link>
        </div>

        <div className="flex flex-col justify-center gap-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
                  {stageInfo.icon}
                  {displayStage}
                </span>
                {plant.cycles?.name && (
                  <span className="chip border-line bg-surface-2 text-fg-muted">{plant.cycles.name}</span>
                )}
              </div>
              <LogModal plantId={plant.id} plantName={plant.name} />
            </div>

            <h2 className="font-title text-3xl font-semibold tracking-tight text-fg md:text-4xl">{plant.name}</h2>
            {plant.strain && <p className="mt-1 text-sm text-fg-muted">{plant.strain}</p>}
          </div>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="surface rounded-[var(--radius-lg)] p-4">
              <dt className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                <Calendar size={14} aria-hidden="true" />
                Edad total
              </dt>
              <dd className="font-title text-2xl font-semibold text-fg">
                <PlantMetricsDisplay plant={plant} type="totalAge" />
                <span className="ml-1 text-sm font-normal text-fg-muted">días</span>
              </dd>
            </div>

            <div className={`rounded-[var(--radius-lg)] border p-4 ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
              <dt className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                <History size={14} aria-hidden="true" />
                En etapa
              </dt>
              <dd className="font-title text-2xl font-semibold">
                <PlantMetricsDisplay plant={plant} type="daysInCurrentStage" />
                <span className="ml-1 text-sm font-normal opacity-80">días</span>
              </dd>
            </div>

            <div className={`col-span-2 rounded-[var(--radius-lg)] border p-4 md:col-span-1 ${waterCardClasses}`}>
              <dt className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
                <Droplets size={14} aria-hidden="true" />
                Riego
              </dt>
              <dd className={`flex items-center gap-1.5 font-title text-xl font-semibold ${waterTextClasses}`}>
                {daysSinceWater !== null && daysSinceWater >= 4 && (
                  <AlertTriangle size={17} aria-hidden="true" />
                )}
                {daysSinceWater === null
                  ? 'Sin registro'
                  : daysSinceWater === 0
                    ? 'Hoy'
                    : `Hace ${daysSinceWater} días`}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <section aria-labelledby="bitacora" className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2.5 border-b border-line pb-4">
          <History className="text-[color:var(--brand-text)]" size={18} aria-hidden="true" />
          <h2 id="bitacora" className="font-title text-lg font-semibold text-fg">Bitácora de seguimiento</h2>
        </div>

        <TimelineSection
          pendingTasks={pendingTimelineItems}
          historyItems={historyTimelineItems}
        />
      </section>
    </main>
  );
}
