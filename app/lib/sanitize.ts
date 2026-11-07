/**
 * Lo que llega del cliente a una Server Action, depurado.
 *
 * Los tipos de TypeScript no existen en tiempo de ejecución: una acción que
 * recibe `Partial<Space>` y se lo pasa a `.update()` deja escribir cualquier
 * columna. Acá cada acción declara qué campos acepta y cómo se leen; lo que
 * no está en la lista se ignora y lo que no se entiende se informa.
 */

/** Devuelve el valor ya limpio, o `INVALID` si no se puede usar. */
export const INVALID = Symbol('invalid');
export type Parser<T> = (value: unknown) => T | typeof INVALID;

export function requiredText(max = 200): Parser<string> {
  return (value) => {
    if (typeof value !== 'string') return INVALID;
    const text = value.trim().slice(0, max);
    return text ? text : INVALID;
  };
}

/** Texto opcional: vacío o null quedan en null. */
export function optionalText(max = 500): Parser<string | null> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return INVALID;
    const text = value.trim().slice(0, max);
    return text || null;
  };
}

/**
 * Un número como se escribe en Argentina: "1,5" es uno y medio y "1.000" es
 * mil. Antes se cambiaba la coma por punto y nada más, así que un envase de
 * "1.000" ml se guardaba como 1 ml.
 *
 * - Con punto y coma, el último separador es el decimal ("1.000,5", "1,000.5").
 * - Sólo coma: decimal ("2,5").
 * - Sólo puntos en grupos de tres ("1.000", "12.500"): de miles. Si no, decimal ("1.5").
 *
 * Vacío → undefined; lo que no es un número → NaN.
 */
export function parseDecimal(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const text = String(value).trim().replace(/[\s ]/g, '');
  if (text === '') return undefined;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let normalized = text;
  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    normalized = text.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    normalized = text.indexOf(',') === lastComma ? text.replace(',', '.') : 'NaN';
  } else if (lastDot !== -1 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.split('.').join('');
  }
  return Number(normalized);
}

/** Número opcional dentro de un rango; vacío queda en null. */
export function optionalNumber(
  options: { min?: number; max?: number; integer?: boolean } = {}
): Parser<number | null> {
  const { min = -Infinity, max = Infinity, integer = false } = options;
  return (value) => {
    const number = parseDecimal(value);
    if (number === undefined) return null;
    if (!Number.isFinite(number)) return INVALID;
    const result = integer ? Math.round(number) : number;
    if (result < min || result > max) return INVALID;
    return result;
  };
}

export function oneOf<const T extends string>(values: readonly T[]): Parser<T> {
  return (value) => (typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : INVALID);
}

/** Acepta null además de lo que acepte `parse`. */
export function nullable<T>(parse: Parser<T>): Parser<T | null> {
  return (value) => (value === null ? null : parse(value));
}

/** Id de una fila: entero positivo. */
export function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Lista de ids sin repetidos; lo que no es un id se descarta. */
export function parseIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(parseId).filter((id): id is number => id !== null)));
}

type Schema = Record<string, Parser<unknown>>;
type Parsed<S extends Schema> = { [K in keyof S]?: Exclude<ReturnType<S[K]>, typeof INVALID> };

/**
 * Se queda con los campos del esquema que vinieron en `input`.
 * Un campo ausente no se toca; uno presente pero inválido va a `invalid`.
 */
export function pickFields<S extends Schema>(input: unknown, schema: S): { data: Parsed<S>; invalid: string[] } {
  const data: Record<string, unknown> = {};
  const invalid: string[] = [];
  if (!input || typeof input !== 'object') return { data: data as Parsed<S>, invalid };

  for (const [key, parse] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const raw = (input as Record<string, unknown>)[key];
    if (raw === undefined) continue;
    const value = parse(raw);
    if (value === INVALID) invalid.push(key);
    else data[key] = value;
  }

  return { data: data as Parsed<S>, invalid };
}
