// Převody mezi ISO datem a excelovým sériovým číslem (dny od 30. 12. 1899).
// Počítá se v UTC bez objektů Date v místní zóně, aby export i import byly nezávislé na časové zóně.

import type { PracovniCas } from '../domain/types';

const DEN_MS = 86_400_000;
const EXCEL_EPOCHA_MS = Date.UTC(1899, 11, 30);

export function isoNaExcelSerial(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Neplatné ISO datum: "${iso}"`);
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EXCEL_EPOCHA_MS) / DEN_MS);
}

/** Sériové číslo (celé nebo s časem) → ISO datum (čas se zahodí). */
export function excelSerialNaIso(serial: number): string | undefined {
  if (!Number.isFinite(serial) || serial < 1) return undefined;
  return new Date(EXCEL_EPOCHA_MS + Math.floor(serial) * DEN_MS).toISOString().slice(0, 10);
}

/** Text `15.10.2026`, `15. 10. 2026` nebo `2026-10-15` → ISO; jinak undefined. */
export function textNaIso(text: string): string | undefined {
  const t = text.trim();
  let rok: number;
  let mesic: number;
  let den: number;
  let m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(t);
  if (m) {
    den = Number(m[1]);
    mesic = Number(m[2]);
    rok = Number(m[3]);
  } else {
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (!m) return undefined;
    rok = Number(m[1]);
    mesic = Number(m[2]);
    den = Number(m[3]);
  }
  const d = new Date(Date.UTC(rok, mesic - 1, den));
  if (d.getUTCFullYear() !== rok || d.getUTCMonth() !== mesic - 1 || d.getUTCDate() !== den) return undefined;
  return d.toISOString().slice(0, 10);
}

/** JS Date (složky v místní zóně, jak je vytváří SheetJS) → ISO. */
export function dateNaIso(d: Date): string | undefined {
  if (Number.isNaN(d.getTime())) return undefined;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const ZACATEK_SMENY_HOD = 8;

/**
 * Pracovní čas → sériové číslo s časem: den + (8:00 + zlomek × hodDen hodin).
 * Pro 8 h/den je zlomek 0,5 = 12:00; pro stroj s 16 h/den = 16:00.
 */
export function pracovniCasNaExcelSerial(cas: PracovniCas, hodDen: number): number {
  return isoNaExcelSerial(cas.den) + (ZACATEK_SMENY_HOD + cas.zlomek * hodDen) / 24;
}
