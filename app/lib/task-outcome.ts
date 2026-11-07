/**
 * LOS AVISOS AL COMPLETAR O DESMARCAR UNA TAREA
 * ------------------------------------------------------------------
 * Completar una tarea cambia plantas y escribe la bitácora; el aviso cuenta
 * qué pasó en palabras ("2 plantas pasaron a Secado") y, si algún paso falló,
 * lo dice en vez de festejar. Puro: el servidor arma el resultado y esto lo
 * pone en castellano.
 */

export interface CompletionOutcome {
  /** Plantas activas que alcanzó la tarea. */
  plants: number;
  /** Plantas a las que se les anotó el riego. */
  water: number;
  stage?: { stage: string; changed: number };
  archived: number;
  /** Fichas de cosecha creadas. */
  harvests: number;
  /** Plantas con registro nuevo en la bitácora. */
  logs: number;
  feed?: { plants: number; lowStock: { name: string; stock_ml: number | null }[] };
  move?: { spaceName: string; cycles: number; plants: number; unplaced: number };
  /** Pasos que fallaron, ya en palabras. */
  problems: string[];
}

export interface Notice {
  message: string;
  tone: 'success' | 'error';
}

function plantsLabel(count: number): string {
  return count === 1 ? '1 planta' : `${count} plantas`;
}

function moveSentence(move: NonNullable<CompletionOutcome['move']>): string {
  const parts: string[] = [];
  if (move.cycles > 0) parts.push(move.cycles === 1 ? '1 ciclo' : `${move.cycles} ciclos`);
  if (move.plants > 0) parts.push(plantsLabel(move.plants));

  const sentences: string[] = [];
  if (parts.length > 0) {
    const moved = move.cycles + move.plants;
    sentences.push(`${parts.join(' y ')} ${moved === 1 ? 'pasó' : 'pasaron'} a ${move.spaceName}.`);
  }
  if (move.unplaced > 0) {
    const plants = move.unplaced === 1 ? '1 planta no se movió' : `${move.unplaced} plantas no se movieron`;
    sentences.push(`${plants}: ${move.spaceName} no tiene un ciclo donde ponerla${move.unplaced === 1 ? '' : 's'}.`);
  }
  if (sentences.length === 0) sentences.push(`Ya estaba todo en ${move.spaceName}.`);
  return sentences.join(' ');
}

function effectSentence(type: string, outcome: CompletionOutcome): string | null {
  if (outcome.move) return moveSentence(outcome.move);
  if (outcome.plants === 0) return 'No alcanzó a ninguna planta activa.';

  if (outcome.feed) {
    let sentence = outcome.feed.plants > 0 ? `Quedó en la bitácora de ${plantsLabel(outcome.feed.plants)}.` : '';
    if (outcome.feed.lowStock.length > 0) {
      const low = outcome.feed.lowStock.map((item) => `${item.name} (${(item.stock_ml ?? 0).toLocaleString('es-AR')})`).join(', ');
      sentence += `${sentence ? ' ' : ''}Queda poco: ${low}.`;
    }
    return sentence || null;
  }

  if (outcome.stage) {
    const { stage, changed } = outcome.stage;
    let sentence = changed > 0
      ? `${plantsLabel(changed)} ${changed === 1 ? 'pasó' : 'pasaron'} a ${stage}.`
      : outcome.plants === 1 ? `La planta ya estaba en ${stage}.` : `Las plantas ya estaban en ${stage}.`;
    if (type === 'cosechar' && outcome.harvests > 0) {
      sentence += outcome.harvests === 1 ? ' Tiene su ficha de cosecha.' : ` Las ${outcome.harvests} tienen su ficha de cosecha.`;
    }
    return sentence;
  }

  if (outcome.archived > 0) {
    return `${plantsLabel(outcome.archived)} ${outcome.archived === 1 ? 'se archivó' : 'se archivaron'}.`;
  }
  if (outcome.water > 0) return `Se anotó el riego de ${plantsLabel(outcome.water)}.`;
  if (outcome.logs > 0) return `Quedó en la bitácora de ${plantsLabel(outcome.logs)}.`;
  return null;
}

/** El aviso al completar: qué cambió y, si algo falló, qué. */
export function describeCompletion(type: string, outcome: CompletionOutcome): Notice {
  const sentences = ['¡Tarea completada!'];
  const effect = effectSentence(type, outcome);
  if (effect) sentences.push(effect);
  if (outcome.problems.length > 0) sentences.push(`Ojo: ${outcome.problems.join(' ')}`);
  return { message: sentences.join(' '), tone: outcome.problems.length > 0 ? 'error' : 'success' };
}

/** El aviso al desmarcar una tarea (o tocar "Deshacer"). */
export function describeReopen(result: { undone: boolean; kept: number; failures: number; esquejes: number }): Notice {
  if (result.failures > 0) {
    return {
      message: 'La tarea volvió a pendiente, pero algún cambio no se pudo deshacer. Revisá las plantas.',
      tone: 'error',
    };
  }

  if (result.esquejes > 0) {
    return {
      message: result.esquejes === 1
        ? 'Tarea pendiente. El esqueje creado se mantiene.'
        : `Tarea pendiente. Los ${result.esquejes} esquejes creados se mantienen.`,
      tone: 'success',
    };
  }

  if (!result.undone) return { message: 'Tarea marcada como pendiente.', tone: 'success' };

  let message = 'Listo, se deshizo la tarea.';
  if (result.kept > 0) {
    message += result.kept === 1
      ? ' 1 cambio no se tocó porque cambió después.'
      : ` ${result.kept} cambios no se tocaron porque cambiaron después.`;
  }
  return { message, tone: 'success' };
}
