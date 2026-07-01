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

  let waterCardClasses = "bg-card border-card-border";
  let waterTextClasses = "text-foreground";
  if (daysSinceWater !== null) {
    if (daysSinceWater >= 4) {
      waterCardClasses = "bg-red-500/5 border-red-500/50";
      waterTextClasses = "text-red-400";
    } else if (daysSinceWater === 3) {
      waterCardClasses = "bg-card border-yellow-500/40";
      waterTextClasses = "text-yellow-200";
    }
  }

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground p-4 md:p-8 font-body">
      
      <GlobalHeader userEmail={user?.email} title="Ficha Técnica" subtitle={plant.name} />

      {/* --- HERO SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Foto Principal */}
        <div className="relative aspect-square md:aspect-video rounded-2xl overflow-hidden border border-card-border bg-card group">
          {plant.image_url ? (
            <Image src={plant.image_url} alt={plant.name} fill className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-brand-primary opacity-20">
                <Sprout size={64} />
            </div>
          )}
          <div className="absolute top-4 right-4">
            <Link
                href={`/plants/${plant.id}/edit`}
                className="bg-slate-100 hover:bg-slate-200 text-foreground p-2 rounded-lg border border-card-border transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
            >
                <Edit size={14} /> Editar
            </Link>
          </div>
        </div>

        {/* Datos Técnicos */}
        <div className="flex flex-col justify-center space-y-6">
            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
                            {stageInfo.icon} {displayStage}
                        </span>
                        <span className="text-xs text-muted uppercase tracking-widest font-bold">
                            {plant.cycles?.name}
                        </span>
                    </div>
                    <LogModal plantId={plant.id} plantName={plant.name} />
                </div>
                <h1 className="text-4xl md:text-5xl font-title font-light text-foreground mb-4">{plant.name}</h1>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-card p-4 rounded-2xl border border-card-border">
                    <div className="flex items-center gap-2 mb-1 text-muted">
                        <Calendar size={14} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Edad Total</span>
                    </div>
                    <p className="text-2xl font-light text-foreground"><PlantMetricsDisplay plant={plant} type="totalAge" /> <span className="text-sm text-muted">días</span></p>
                </div>
                <div className={`p-4 rounded-2xl border flex flex-col justify-center ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
                    <div className={`flex items-center gap-2 mb-1 opacity-80`}>
                        <History size={14} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">En Etapa</span>
                    </div>
                    <p className={`text-2xl font-light`}><PlantMetricsDisplay plant={plant} type="daysInCurrentStage" /> <span className="text-sm opacity-60">días</span></p>
                </div>
                <div className={`p-4 rounded-2xl border flex flex-col justify-center col-span-2 md:col-span-1 ${waterCardClasses}`}>
                    <div className="flex items-center gap-2 mb-1 opacity-80">
                        <Droplets size={14} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Riego</span>
                    </div>
                    <div className={`flex items-center gap-2 text-xl font-light ${waterTextClasses} truncate`}>
                        {daysSinceWater !== null && daysSinceWater >= 4 && <AlertTriangle size={18} />}
                        <span>
                            {daysSinceWater === null
                                ? '-'
                                : daysSinceWater === 0
                                    ? 'Hoy'
                                    : `Hace ${daysSinceWater} días`}
                        </span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* --- BITÁCORA (Timeline) --- */}
      <section className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6 border-b border-card-border pb-4">
            <History className="text-brand-primary" size={20} />
            <h2 className="text-lg font-title text-foreground">Bitácora de Seguimiento</h2>
        </div>

        <TimelineSection
          pendingTasks={pendingTimelineItems}
          historyItems={historyTimelineItems}
        />
      </section>
    </main>
  );
}