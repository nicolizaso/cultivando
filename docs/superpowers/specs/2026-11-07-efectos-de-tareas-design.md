# Efectos de las tareas — diseño

Fecha: 2026-11-07 · Enfoque aprobado: A (reglas por tipo en el código,
reusando las escrituras de las acciones manuales).

## Objetivo

Que completar cada tarea haga lo que dice su tipo y **siempre** deje rastro en
la bitácora, igual que si se hubiera hecho a mano. Que desmarcarla lo deshaga y
que editarla no deje la tarea diciendo una cosa y la planta otra.

## Lo que estaba mal (resumen del análisis)

- Riego, cambio de etapa, cosechar y declarar muerta cambiaban la planta sin
  escribir la bitácora (en producción: 25 riegos completados, ningún registro).
  Poda, trasplante, entrenamiento, repelente, lavado y "Otro" sólo se tachaban.
- "Cambiar ambiente" de una planta sólo andaba si el destino tenía un único
  ciclo activo; sin destino guardado decía "completada" y no hacía nada, y el
  editor no dejaba elegir el destino.
- Cosechar no creaba la ficha de cosecha. Lavado no contaba como riego.
  Esquejado sobre una planta ofrecía como madres a todo su ciclo.
- Atrasadas: el efecto quedaba con el día agendado.
- Editar una completada no tocaba las plantas; el título de una tarea tipada se
  podía cambiar. Desmarcar no deshacía; desmarcar y volver a marcar un
  fertilizante lo anotaba (y descontaba) dos veces. Deshacer una mudanza
  agregaba un registro de vuelta en vez de borrar el de ida. Los errores se
  contaban como éxito.
- Código muerto: `update_task_series` en la base, el parámetro descartado de
  `updateTask`, `onDelete`/`readOnly` de `TaskPill`.

## Qué hace cada tipo al completarse

Todas escriben un registro por planta alcanzada, con `data.task_id`, fechado el
día en que se hizo.

| Tipo | Cambio | Registro |
| --- | --- | --- |
| Riego | `last_water` | `riego` · "Riego" |
| Lavado de raíces | `last_water` | `lavado` · "Lavado de raíces" |
| Fertilizante | con mezcla: bitácora con la mezcla y stock (como hoy); si se aplicó en el agua, `last_water` | `fertilizante` |
| Cambio de etapa | etapa y su fecha (sólo las que no estaban ya) | `cambio_etapa` · "Cambio de etapa a X" (sólo las que cambiaron) |
| Cosechar | pasa a Secado (sólo hacia adelante) y crea la ficha de cosecha si no tenía, con peso húmedo opcional | `cosechar` · "Cosecha" |
| Declarar muerta | archiva | `muerta` · "Declarada muerta", con el motivo |
| Cambiar ambiente | ver abajo | `ambiente` |
| Esquejado | como hoy (modal propio) | `esquejado` en cada madre |
| Poda, Trasplante, Entrenamiento, Repelente, Otro | — | su tipo, con el título y las notas de la tarea |

### Cambiar ambiente

1. Los ciclos elegidos enteros se mudan al espacio destino.
2. Si se eligieron sueltas **todas** las plantas activas de un ciclo, se muda el
   ciclo entero.
3. Las demás plantas sueltas pasan a un ciclo del destino: el que se elija al
   completar, o el único activo; si no hay o hay varios, al completar se pide
   elegir uno o crear uno nuevo en ese espacio.
4. Sin destino guardado no se puede completar: se elige en el momento (y queda
   guardado en la tarea) o desde "Editar".

Registro: uno por ciclo mudado (a nivel ciclo, como la mudanza manual) y uno por
planta pasada de ciclo.

## Completar

- Se completa con un toque si no hay nada que preguntar.
- Se abre una hoja cuando hace falta algo: la tarea está **atrasada** (pide sólo
  el día en que se hizo, hoy por defecto), es un fertilizante con mezcla
  (litros y stock), es cosechar (pesos húmedos opcionales), es cambiar ambiente
  (confirmación y, si hace falta, destino o ciclo) o es declarar muerta
  (confirmación y motivo).
- Si algún paso falla, el aviso lo dice.

## Desmarcar = deshacer

Sin límite de tiempo. Borra los registros de la tarea y revierte cada cambio
**sólo si sigue como lo dejó la tarea** (si después se cambió a mano, no se
toca): riego, etapa, archivado, ficha de cosecha creada (si no se le cargó peso
seco), plantas pasadas de ciclo, ciclos mudados y el ciclo creado por la tarea
(si quedó vacío). El stock descontado se devuelve. El esquejado no se deshace:
los esquejes son plantas con su propia historia.

Desmarcar una tarea con cambios pide confirmación. El "Deshacer" del aviso hace
lo mismo, sin preguntar.

## Editar

- Pendiente: día, notas, mezcla y forma de aplicar (fertilizante), etapa
  destino (cambio de etapa) y espacio destino (cambiar ambiente). El título sólo
  se edita en "Otro"; en el resto sale del tipo.
- Completada: sólo las notas. Para lo demás, primero se desmarca.
- En una serie, "esta y las siguientes" no toca las ya completadas.

## Vistas

- Ficha de la planta: una tarea completada que dejó registros se muestra por sus
  registros, no dos veces.
- Agenda: los registros que escribió una tarea no se repiten al lado de la
  tarea.

## Piezas

- `app/lib/task-effects.ts` (puro, con tests): qué hace cada tipo, fecha del
  efecto, plan de mudanza.
- `app/lib/task-outcome.ts` (puro, con tests): el texto de los avisos.
- `app/lib/task-undo.ts` (puro, con tests): `last_effect` con lo que la tarea
  escribió, para revertir sólo si sigue igual.
- `app/lib/plant-writes.ts` (servidor): escrituras compartidas entre las
  acciones manuales y las tareas (etapa, riego, archivado, cambio de ciclo,
  mudanza de ciclo y bitácora con `task_id`).
- `app/actions/tasks.ts`: `completeTask`, `reopenTask`,
  `getCompletionContext`; `updateTask` con las reglas de edición.
- `components/CompleteTaskSheet.tsx` reemplaza a `FeedCompleteModal` y a la
  confirmación suelta de la agenda.

## Base de datos

No hace falta ningún cambio para que funcione (`delete_task_logs` ya existe y la
bitácora acepta todos los tipos). Una migración borra `update_task_series`, que
nadie usa.

## Fuera de alcance

Reconstruir registros de las tareas viejas ya completadas (decidido: no).
Editar los objetivos o el tipo de una tarea.
