'use server'

import { createClient } from "@/app/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { randomUUID } from 'crypto'
import { mapTaskCycles } from "../lib/utils"
import {
  buildClonePlants,
  sanitizeCloneEntries,
  totalClones,
  validateCloneEntries,
} from "../lib/clones"
import type { CloneEntry, CloneMother } from "../lib/clones"
import type { TaskMetadata } from "../lib/types"
import { getStageDateColumn } from "../lib/stage-logic"
import { getTaskCompletionEffect, shouldApplyStage } from "../lib/task-effects"
import type { TaskEffect } from "../lib/task-effects"

export async function createTask(formData: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { targets, taskType, applicationType, targetStage, targetSpaceId, date, description, otherText, isRecurring, frequency, endDate } = formData
  if (!targets || targets.length === 0) return { error: 'Selecciona un objetivo.' }

  const title = taskType.id === 'otro' ? otherText : taskType.label
  if (!title) return { error: 'Falta el título.' }

  const recurrenceId = isRecurring ? randomUUID() : null

  // 1. Resolve Target Metadata (cycle_id and linked plants)
  const allPlantIds = new Set<string>();
  const encounteredCycleIds = new Set<number>();

  await Promise.all(targets.map(async (target: any) => {
    if (target.type === 'plant') {
      const { data: plant } = await supabase.from('plants').select('cycle_id').eq('id', target.id).single();
      if (plant?.cycle_id) encounteredCycleIds.add(plant.cycle_id);
      allPlantIds.add(String(target.id));
    } else if (target.type === 'space') {
      // Buscamos ciclos activos asociados al espacio para vincular la tarea
      const { data: cycles } = await supabase.from('cycles').select('id').eq('space_id', target.id).eq('is_active', true);
      const spaceCycleIds = cycles?.map((c: any) => c.id) ?? [];
      spaceCycleIds.forEach((id: number) => encounteredCycleIds.add(id));

      // Las plantas no guardan el espacio: viven en el ciclo y el ciclo en el
      // espacio. Antes se buscaban por una columna `space_id` que la tabla no
      // tiene, así que una tarea por espacio terminaba sin ninguna planta.
      if (spaceCycleIds.length > 0) {
        const { data: plants } = await supabase.from('plants').select('id, cycle_id').in('cycle_id', spaceCycleIds);
        plants?.forEach((p: any) => {
          allPlantIds.add(String(p.id));
          if (p.cycle_id) encounteredCycleIds.add(p.cycle_id);
        });
      }
    } else if (target.type === 'cycle') {
      encounteredCycleIds.add(target.id);
      // Obtenemos todas las plantas que pertenecen a este ciclo
      const { data: plants } = await supabase.from('plants').select('id').eq('cycle_id', target.id);
      plants?.forEach((p: any) => {
        allPlantIds.add(String(p.id));
      });
    }
  }));

  const uniqueCycleIds = Array.from(encounteredCycleIds);
  const linkedPlantIds = Array.from(allPlantIds);

  // 2. Generate Dates
  const datesToInsert: string[] = [];

  if (isRecurring && endDate) {
      const startDateObj = new Date(date);
      const endDateObj = new Date(endDate);
      const current = new Date(startDateObj);
      let count = 0;
      const maxIterations = 50;

      while (current <= endDateObj && count < maxIterations) {
          const year = current.getFullYear();
          const month = String(current.getMonth() + 1).padStart(2, '0');
          const day = String(current.getDate()).padStart(2, '0');
          datesToInsert.push(`${year}-${month}-${day}T12:00:00`);

          switch (frequency) {
              case 'daily': current.setDate(current.getDate() + 1); break;
              case 'every2days': current.setDate(current.getDate() + 2); break;
              case 'weekly': current.setDate(current.getDate() + 7); break;
              case 'biweekly': current.setDate(current.getDate() + 14); break;
              case 'monthly': current.setMonth(current.getMonth() + 1); break;
              default: current.setDate(current.getDate() + 1);
          }
          count++;
      }
  } else {
      // Ensure consistent T12:00:00 format for single dates too
      const d = date.includes('T') ? date : `${date}T12:00:00`;
      datesToInsert.push(d);
  }

  // 3. Create Tasks (One per date)
  const tasksData = datesToInsert.map(d => ({
      user_id: user.id,
      title: title,
      description: description || null,
      due_date: d,
      date: d, // Keep for compatibility
      type: taskType.id,
      application_type: taskType.id === 'fertilizante' ? applicationType : null,
      target_stage: taskType.id === 'cambio_etapa' ? targetStage : null,
      target_space_id: taskType.id === 'ambiente' && targetSpaceId ? targetSpaceId : null,
      status: 'pending',
      recurrence_id: recurrenceId,
      cycle_id: null
  }));

  const { data: insertedTasks, error } = await supabase.from('tasks').insert(tasksData).select('id');
  if (error) return { error: error.message };

  // 4. Link Plants and Cycles via Junction Tables
  if (insertedTasks) {
      // 4a. Link Cycles
      if (uniqueCycleIds.length > 0) {
          const taskCyclesData = [];
          for (const task of insertedTasks) {
              for (const cycleId of uniqueCycleIds) {
                  taskCyclesData.push({
                      task_id: task.id,
                      cycle_id: cycleId
                  });
              }
          }
          if (taskCyclesData.length > 0) {
              const { error: tcError } = await supabase.from('task_cycles').insert(taskCyclesData);
              if (tcError) console.error('Error linking task_cycles:', tcError);
          }
      }

      // 4b. Link Plants
      if (linkedPlantIds.length > 0) {
          const taskPlantsData = [];
          for (const task of insertedTasks) {
              for (const plantId of linkedPlantIds) {
                  taskPlantsData.push({
                      task_id: task.id,
                      plant_id: plantId
                  });
              }
          }
          if (taskPlantsData.length > 0) {
              const { error: tpError } = await supabase.from('task_plants').insert(taskPlantsData);
              if (tpError) console.error('Error linking task_plants:', tpError);
          }
      }
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true }
}

// --- NUEVAS FUNCIONES PARA EL POPUP ---

export async function updateTask(taskId: string | number, updates: any, scope: 'single' | 'all_future' = 'single', recurrenceId?: string) {
  const supabase = await createClient()
  
  if (scope === 'single') {
    const { error } = await supabase
      .from('tasks')
      .update({
        title: updates.title,
        description: updates.description,
        application_type: updates.application_type !== undefined ? updates.application_type : null,
        target_stage: updates.target_stage !== undefined ? updates.target_stage : null,
        due_date: updates.date,
        date: updates.date
      })
      .eq('id', taskId)

    if (error) return { error: error.message }
  } else if (scope === 'all_future' && recurrenceId) {
    // 1. Fetch current task to get old date
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('due_date')
      .eq('id', taskId)
      .single()

    if (fetchError || !currentTask) return { error: 'Task not found' }

    // 2. Calculate delta days
    // Ensure we parse dates correctly (YYYY-MM-DD)
    const oldDateStr = currentTask.due_date.split('T')[0]
    const newDateStr = updates.date.split('T')[0]

    const oldDate = new Date(oldDateStr)
    const newDate = new Date(newDateStr)

    const diffTime = newDate.getTime() - oldDate.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    // 3. Fetch all future tasks in series (inclusive of current task)
    const { data: futureTasks, error: listError } = await supabase
      .from('tasks')
      .select('*')
      .eq('recurrence_id', recurrenceId)
      .gte('due_date', currentTask.due_date)

    if (listError) return { error: listError.message }
    if (!futureTasks || futureTasks.length === 0) return { success: true }

    // 4. Update each task
    const updatesPromises = futureTasks.map(task => {
      // Apply date shift
      const taskDate = new Date(task.due_date.split('T')[0]) // Parse local YYYY-MM-DD
      taskDate.setDate(taskDate.getDate() + diffDays)

      // Format back to YYYY-MM-DD
      const shiftedDateStr = taskDate.toISOString().split('T')[0]
      const shiftedDateFull = `${shiftedDateStr}T12:00:00` // Append noon

      return supabase.from('tasks').update({
        title: updates.title || task.title,
        description: updates.description !== undefined ? updates.description : task.description,
        application_type: updates.application_type !== undefined ? updates.application_type : task.application_type,
        target_stage: updates.target_stage !== undefined ? updates.target_stage : task.target_stage,
        due_date: shiftedDateFull,
        date: shiftedDateFull
      }).eq('id', task.id)
    })

    await Promise.all(updatesPromises)
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true }
}

export async function deleteTasks(taskIds: (string | number)[]) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .in('id', taskIds)

  if (error) return { error: error.message }

  revalidatePath('/')
  revalidatePath('/calendar')
  return { success: true }
}

export async function toggleTaskStatus(taskId: string | number, newStatus: 'pending' | 'completed') {
  const supabase = await createClient()

  // Check current status to prevent duplicate logs/updates
  const { data: currentTask, error: fetchError } = await supabase
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (currentTask.status === newStatus) return { success: true }

  const completedAt = new Date().toISOString()
  const updateData: any = { status: newStatus }
  if (newStatus === 'completed') {
    updateData.completed_at = completedAt
  } else {
    updateData.completed_at = null
  }

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  if (error) return { error: error.message }

  let effects: TaskCompletionEffects | null = null

  // El esquejado no pasa por acá para completarse: lo hace `completeEsquejado`,
  // que necesita saber de qué plantas salieron los esquejes y cuántos. Al
  // desmarcarla, las plantas creadas se quedan donde están.
  if (newStatus === 'completed') {
    const { data: task } = await supabase
      .from('tasks')
      .select(`
        *,
        task_plants (
          plant_id,
          plants ( id, cycle_id, stage )
        ),
        task_cycles (
          cycle_id
        )
      `)
      .eq('id', taskId)
      .single()

    if (task) {
      const plantIds = task.task_plants ? task.task_plants.map((tp: any) => tp.plant_id) : []

      const effect = getTaskCompletionEffect(task)
      if (effect && plantIds.length > 0) {
        effects = await applyTaskCompletionEffect(supabase, effect, task.task_plants, completedAt)
      }

      // Nueva lógica para cambiar ambiente
      if (task.type === 'ambiente' && task.target_space_id) {
        const environmentPlantIds = task.task_plants?.map((tp: any) => tp.plant_id) || [];
        const cycleIds = task.task_cycles?.map((tc: any) => tc.cycle_id) || [];

        // 1. Mudar Plantas Individuales
        if (environmentPlantIds.length > 0) {
          const { error: movePlantsError } = await supabase
            .from('plants')
            .update({ space_id: task.target_space_id })
            .in('id', environmentPlantIds)

          if (movePlantsError) console.error('Error moving plants to new space:', movePlantsError)
        }

        // 2. Mudar Ciclos Enteros
        if (cycleIds.length > 0) {
          const { error: moveCyclesError } = await supabase
            .from('cycles')
            .update({ space_id: task.target_space_id })
            .in('id', cycleIds)

          if (moveCyclesError) console.error('Error moving cycles to new space:', moveCyclesError)

          // Mover también todas las plantas de ese ciclo
          const { error: movePlantsCycleError } = await supabase
            .from('plants')
            .update({ space_id: task.target_space_id })
            .in('cycle_id', cycleIds)

          if (movePlantsCycleError) console.error('Error moving plants from cycle to new space:', movePlantsCycleError)
        }
      }
    }
  }

  revalidatePath('/')
  revalidatePath('/calendar')
  if (effects) {
    revalidatePath('/plants')
    revalidatePath('/plants/[id]', 'page')
    revalidatePath('/cycles')
    revalidatePath('/cycles/[id]', 'page')
  }
  return { success: true, effects }
}

/** Lo que cambió en las plantas al completar una tarea, para contárselo al usuario. */
export interface TaskCompletionEffects {
  kind: TaskEffect['kind']
  /** Plantas que efectivamente cambiaron. */
  count: number
  /** La etapa nueva, cuando el efecto es un cambio de etapa. */
  stage?: string
}

type TaskPlantRow = { plant_id: number; plants?: { id: number; stage?: string | null } | null }

/**
 * Aplica sobre las plantas de la tarea el efecto de haberla completado.
 *
 * Si algo falla no se revierte el completado: la tarea sí se hizo, y queda
 * en el log del servidor. Desmarcar la tarea tampoco deshace el efecto, igual
 * que con los esquejes: la etapa o el archivado se corrigen desde la planta.
 */
async function applyTaskCompletionEffect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  effect: TaskEffect,
  taskPlants: TaskPlantRow[] | null | undefined,
  completedAt: string
): Promise<TaskCompletionEffects | null> {
  const rows = taskPlants ?? []

  if (effect.kind === 'water') {
    const ids = rows.map((tp) => tp.plant_id)
    const { error } = await supabase.from('plants').update({ last_water: completedAt }).in('id', ids)
    if (error) {
      console.error('Error updating last_water:', error)
      return null
    }
    return { kind: 'water', count: ids.length }
  }

  if (effect.kind === 'archive') {
    const ids = rows.map((tp) => tp.plant_id)
    const { error } = await supabase.from('plants').update({ is_archived: true }).in('id', ids)
    if (error) {
      console.error('Error archivando plantas al completar la tarea:', error)
      return null
    }
    return { kind: 'archive', count: ids.length }
  }

  // Cambio de etapa: sólo las plantas que no están ya ahí (o más adelante,
  // si el efecto sólo avanza).
  const dateColumn = getStageDateColumn(effect.stage)
  if (!dateColumn) return null

  const ids = rows
    .filter((tp) => tp.plants && shouldApplyStage(tp.plants.stage, effect))
    .map((tp) => tp.plant_id)

  if (ids.length > 0) {
    const { error } = await supabase
      .from('plants')
      .update({
        stage: effect.stage,
        stage_updated_at: completedAt,
        // La columna sale del mapa de etapas, nunca del cliente.
        [dateColumn]: completedAt,
      })
      .in('id', ids)

    if (error) {
      console.error('Error cambiando la etapa al completar la tarea:', error)
      return null
    }
  }

  return { kind: 'stage', count: ids.length, stage: effect.stage }
}

export async function completeTask(taskId: string | number) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'completed' })
    .eq('id', taskId)

  if (error) return { error: error.message }
  
  revalidatePath('/')
  return { success: true }
}

export async function deleteTask(taskId: string | number) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) return { error: error.message }
  
  revalidatePath('/')
  return { success: true }
}

export async function deleteTaskSeries(recurrenceId: string, currentTaskId: string | number, scope: 'this' | 'series') {
  const supabase = await createClient()

  if (scope === 'this') {
    return deleteTask(currentTaskId)
  }

  if (scope === 'series') {
    // Fetch all IDs in series
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id')
      .eq('recurrence_id', recurrenceId)

    if (error) return { error: error.message }
    if (!tasks || tasks.length === 0) return { success: true }

    const ids = tasks.map((t: any) => t.id)
    return deleteTasks(ids)
  }

  return { error: 'Invalid scope' }
}

export async function getAllPendingTasks() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const [tasksResult, cyclesResult] = await Promise.all([
     supabase
      .from('tasks')
      .select('*, task_cycles(cycles(id, name)), task_plants(plants(id, name, cycle_id, cycles(id, name)))')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true }),
     supabase
      .from('cycles')
      .select('id, name')
      .eq('is_active', true)
  ])

  if (tasksResult.error) return { error: tasksResult.error.message }
  if (cyclesResult.error) return { error: cyclesResult.error.message }

  // Map tasks to flatten cycleName
  const tasks = tasksResult.data.map((t: any) => {
    const { cycleIds, cycleNames } = mapTaskCycles(t, cyclesResult.data);

    return {
      ...t,
      cycleIds,
      cycleNames
    }
  })

  return { tasks, cycles: cyclesResult.data }
}

// --- ESQUEJADO ---

/**
 * Todo lo que el modal de esquejado necesita para preguntar: las plantas que
 * la tarea alcanza (las enlazadas y las de sus ciclos, por si el ciclo sumó
 * plantas después de agendarla), los ciclos activos a donde mandar los
 * esquejes y los espacios, por si hay que abrir un ciclo nuevo.
 */
interface CandidatePlantRow {
  id: number
  name: string
  strain?: string | null
  breeder?: string | null
  stage?: string | null
  cycle_id?: number | null
  is_archived?: boolean | null
}

interface CycleRow {
  id: number
  name: string
  space_id?: number
}

export async function getEsquejadoCandidates(taskId: string | number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, user_id, type, status, due_date, metadata, task_plants(plant_id), task_cycles(cycle_id)')
    .eq('id', taskId)
    .single()

  if (taskError || !task) return { error: 'No se encontró la tarea.' }
  if (task.user_id && task.user_id !== user.id) return { error: 'No autorizado.' }

  const cycleIds: number[] = (task.task_cycles ?? []).map((tc: { cycle_id: number }) => tc.cycle_id).filter(Boolean)
  const plantIds: number[] = (task.task_plants ?? []).map((tp: { plant_id: number }) => tp.plant_id).filter(Boolean)

  const columns = 'id, name, strain, breeder, stage, cycle_id, is_archived'
  const [byPlant, byCycle, cyclesResult, spacesResult] = await Promise.all([
    plantIds.length > 0
      ? supabase.from('plants').select(columns).in('id', plantIds)
      : Promise.resolve({ data: [] as CandidatePlantRow[] }),
    cycleIds.length > 0
      ? supabase.from('plants').select(columns).in('cycle_id', cycleIds)
      : Promise.resolve({ data: [] as CandidatePlantRow[] }),
    supabase.from('cycles').select('id, name, space_id').eq('is_active', true).order('name'),
    supabase.from('spaces').select('id, name').order('name'),
  ])

  // Una planta puede venir por los dos lados (enlazada y por su ciclo).
  const candidatesById = new Map<number, CandidatePlantRow>()
  for (const plant of [...(byPlant.data ?? []), ...(byCycle.data ?? [])] as CandidatePlantRow[]) {
    if (plant?.is_archived) continue
    candidatesById.set(Number(plant.id), plant)
  }

  const candidates = Array.from(candidatesById.values()).sort((a, b) =>
    String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es')
  )

  const activeCycles: CycleRow[] = cyclesResult.data ?? []
  const defaultCycleId =
    cycleIds.find((id) => activeCycles.some((c) => c.id === id)) ??
    candidates.find((p) => p.cycle_id)?.cycle_id ??
    activeCycles[0]?.id ??
    null

  return {
    candidates,
    cycles: activeCycles,
    spaces: spacesResult.data ?? [],
    defaultCycleId,
    dueDate: task.due_date ?? null,
    alreadyRegistered: (task.metadata as TaskMetadata | null)?.esquejado ?? null,
  }
}

/**
 * Completa una tarea de esquejado creando las plantas que salieron de ella.
 *
 * Cada esqueje nace el día del corte: día 0 en Enraizamiento, con la genética y
 * la madre heredadas. El reparto (qué madre, cuántos) llega del cliente, así
 * que se depura contra las plantas que la tarea realmente alcanza.
 *
 * Es idempotente: si la tarea ya tiene esquejes registrados (porque se desmarcó
 * y se volvió a completar), vuelve a marcarla completada sin duplicar plantas.
 */
export async function completeEsquejado(
  taskId: string | number,
  payload: {
    date: string
    entries: CloneEntry[]
    targetCycleId?: number | null
    newCycle?: { name: string; spaceId: number } | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Debes iniciar sesión.' }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, user_id, type, metadata, task_plants(plant_id), task_cycles(cycle_id)')
    .eq('id', taskId)
    .single()

  if (taskError || !task) return { error: 'No se encontró la tarea.' }
  if (task.user_id && task.user_id !== user.id) return { error: 'No autorizado.' }
  if (task.type !== 'esquejado') return { error: 'La tarea no es de esquejado.' }

  const previous = (task.metadata as TaskMetadata | null)?.esquejado
  if (previous) {
    // Ya se registró antes: sólo hay que volver a cerrarla.
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', taskId)

    if (error) return { error: error.message }

    revalidateEsquejado()
    return { success: true, created: 0, alreadyRegistered: previous }
  }

  // 1. Candidatas reales de la tarea: las enlazadas más las de sus ciclos.
  const cycleIds: number[] = (task.task_cycles ?? []).map((tc: { cycle_id: number }) => tc.cycle_id).filter(Boolean)
  const linkedPlantIds: number[] = (task.task_plants ?? []).map((tp: { plant_id: number }) => tp.plant_id).filter(Boolean)

  const [byPlant, byCycle] = await Promise.all([
    linkedPlantIds.length > 0
      ? supabase.from('plants').select('id, name, strain, breeder').in('id', linkedPlantIds)
      : Promise.resolve({ data: [] as CandidatePlantRow[] }),
    cycleIds.length > 0
      ? supabase.from('plants').select('id, name, strain, breeder').in('cycle_id', cycleIds)
      : Promise.resolve({ data: [] as CandidatePlantRow[] }),
  ])

  const mothersById = new Map<number, CandidatePlantRow>()
  for (const plant of [...(byPlant.data ?? []), ...(byCycle.data ?? [])] as CandidatePlantRow[]) {
    mothersById.set(Number(plant.id), plant)
  }

  const entries = sanitizeCloneEntries(payload.entries, mothersById.keys())
  const invalid = validateCloneEntries(entries)
  if (invalid) return { error: invalid }

  const total = totalClones(entries)
  const date = payload.date || new Date().toLocaleDateString('en-CA')

  // 2. Sin esquejes no hay plantas que crear, pero la tarea igual se hizo.
  if (total === 0) {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...((task.metadata as object) ?? {}),
          esquejado: {
            date,
            target_cycle_id: null,
            total: 0,
            entries: [],
            registered_at: new Date().toISOString(),
          },
        },
      })
      .eq('id', taskId)

    if (error) return { error: error.message }

    revalidateEsquejado()
    return { success: true, created: 0 }
  }

  // 3. Ciclo destino: uno existente o uno nuevo creado en el momento.
  let targetCycleId = payload.targetCycleId ? Number(payload.targetCycleId) : null
  let targetCycleName: string | null = null

  if (payload.newCycle?.name?.trim()) {
    const { data: created, error: cycleError } = await supabase
      .from('cycles')
      .insert({
        name: payload.newCycle.name.trim(),
        start_date: date,
        space_id: payload.newCycle.spaceId,
        is_active: true,
        user_id: user.id,
      })
      .select('id, name')
      .single()

    if (cycleError || !created) return { error: 'No se pudo crear el ciclo de destino.' }

    targetCycleId = created.id
    targetCycleName = created.name
  } else if (targetCycleId) {
    const { data: cycle } = await supabase
      .from('cycles')
      .select('id, name')
      .eq('id', targetCycleId)
      .single()

    if (!cycle) return { error: 'No se encontró el ciclo de destino.' }
    targetCycleName = cycle.name
  }

  if (!targetCycleId) return { error: 'Elegí a qué ciclo van los esquejes.' }

  // 4. La numeración sigue a la de los esquejes que cada madre ya tenga.
  const motherIds = entries.map((entry) => entry.motherId)
  const { data: existingClones } = await supabase
    .from('plants')
    .select('mother_id')
    .in('mother_id', motherIds)

  const existingByMother = new Map<number, number>()
  for (const row of (existingClones ?? []) as { mother_id: number }[]) {
    const id = Number(row.mother_id)
    existingByMother.set(id, (existingByMother.get(id) ?? 0) + 1)
  }

  const mothers: CloneMother[] = motherIds.map((id) => {
    const plant = mothersById.get(id)
    return {
      id,
      name: plant?.name ?? 'Planta',
      strain: plant?.strain ?? null,
      breeder: plant?.breeder ?? null,
      existingClones: existingByMother.get(id) ?? 0,
    }
  })

  const seeds = buildClonePlants(entries, mothers, { cycleId: targetCycleId, date })

  const { data: insertedPlants, error: insertError } = await supabase
    .from('plants')
    .insert(seeds.map((seed) => ({ ...seed, user_id: user.id })))
    .select('id, mother_id')

  if (insertError) {
    console.error('Error creando esquejes:', insertError)
    return { error: 'No se pudieron crear los esquejes.' }
  }

  // 5. El resultado queda en la tarea: es lo que la vuelve idempotente.
  const plantIdsByMother = new Map<number, number[]>()
  for (const plant of (insertedPlants ?? []) as { id: number; mother_id: number }[]) {
    const id = Number(plant.mother_id)
    plantIdsByMother.set(id, [...(plantIdsByMother.get(id) ?? []), Number(plant.id)])
  }

  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: {
        ...((task.metadata as object) ?? {}),
        esquejado: {
          date,
          target_cycle_id: targetCycleId,
          total,
          registered_at: new Date().toISOString(),
          entries: entries.map((entry) => ({
            mother_id: entry.motherId,
            mother_name: mothersById.get(entry.motherId)?.name ?? null,
            count: entry.count,
            plant_ids: plantIdsByMother.get(entry.motherId) ?? [],
          })),
        },
      },
    })
    .eq('id', taskId)

  if (updateError) return { error: updateError.message }

  revalidateEsquejado()
  return { success: true, created: total, cycleId: targetCycleId, cycleName: targetCycleName }
}

function revalidateEsquejado() {
  revalidatePath('/')
  revalidatePath('/calendar')
  revalidatePath('/plants')
  revalidatePath('/cycles')
  revalidatePath('/cycles/[id]', 'page')
}
