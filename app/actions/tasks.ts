'use server'

import { createClient } from "@/app/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { randomUUID } from 'crypto'
import { mapTaskCycles } from "../lib/utils"

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
      cycles?.forEach((c: any) => encounteredCycleIds.add(c.id));

      // Obtenemos todas las plantas que pertenecen físicamente al espacio para afectarlas a todas.
      const { data: plants } = await supabase.from('plants').select('id, cycle_id').eq('space_id', target.id);
      plants?.forEach((p: any) => {
        allPlantIds.add(p.id);
        if (p.cycle_id) encounteredCycleIds.add(p.cycle_id); // Recolectamos ciclos asociados
      });
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

  const updateData: any = { status: newStatus }
  if (newStatus === 'completed') {
    updateData.completed_at = new Date().toISOString()
  } else {
    updateData.completed_at = null
  }

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  if (error) return { error: error.message }

  if (newStatus === 'completed') {
    const { data: task } = await supabase
      .from('tasks')
      .select(`
        *,
        task_plants (
          plant_id,
          plants ( id, cycle_id )
        ),
        task_cycles (
          cycle_id
        )
      `)
      .eq('id', taskId)
      .single()

    if (task) {
      const plantIds = task.task_plants ? task.task_plants.map((tp: any) => tp.plant_id) : []

      if (plantIds.length > 0 && (task.type === 'riego' || (task.type === 'fertilizante' && task.application_type === 'Riego'))) {
        const { error: waterError } = await supabase
          .from('plants')
          .update({ last_water: new Date().toISOString() })
          .in('id', plantIds)

        if (waterError) console.error('Error updating last_water:', waterError)
      } else if (task.type === 'cambio_etapa' && task.target_stage) {
        // Logica para cambiar etapa
        const stageToColumnMap: { [key: string]: string } = {
          'Germinación': 'date_germinacion',
          'Plántula': 'date_plantula',
          'Vegetativo': 'date_vegetativo',
          'Enraizamiento': 'date_enraizamiento',
          'Floración': 'date_floracion',
          'Secado': 'date_secado',
          'Curado': 'date_curado',
        }

        const dateCol = stageToColumnMap[task.target_stage]
        if (dateCol) {
          const updateObj: any = {
            stage: task.target_stage,
          }
          updateObj[dateCol] = new Date().toISOString()

          const { error: stageError } = await supabase
            .from('plants')
            .update(updateObj)
            .in('id', plantIds)

          if (stageError) console.error('Error updating stage based on target_stage:', stageError)
        }
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
  return { success: true }
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
