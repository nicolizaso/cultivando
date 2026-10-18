/**
 * CSV para abrir en Excel o Google Sheets en español: separador ";" y coma
 * decimal (lo que espera Excel con configuración regional argentina), con BOM
 * para que los acentos no salgan rotos. Puro.
 */

export type CsvValue = string | number | boolean | null | undefined;

/**
 * Una celda. Un texto que empieza con =, +, - o @ se antepone con ' para que
 * la planilla no lo ejecute como fórmula (una nota de la bitácora no puede
 * convertirse en una fórmula al abrir el archivo).
 */
export function csvCell(value: CsvValue, separator = ';'): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return String(Math.round(value * 1000) / 1000).replace('.', ',');
  }
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  const needsQuotes = text.includes(separator) || text.includes('"') || /[\r\n]/.test(text) || text !== text.trim();
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvValue[][], separator = ';'): string {
  return '﻿' + rows.map((row) => row.map((value) => csvCell(value, separator)).join(separator)).join('\r\n') + '\r\n';
}

/** Un nombre de archivo sin caracteres raros: "Ciclo #3 – Otoño" → "ciclo-3-otono". */
export function fileSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'ciclo';
}
