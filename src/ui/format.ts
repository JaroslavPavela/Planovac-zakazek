// Formátování pro UI: datum `d. M. yyyy`, hodiny s desetinnou čárkou.

import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import type { PracovniCas } from '../domain/types';
import { ZACATEK_SMENY_HOD } from '../import/excelDatum';

export function formatDatum(iso: string | undefined, vzor = 'd. M. yyyy'): string {
  if (!iso) return '—';
  return format(parseISO(iso), vzor, { locale: cs });
}

export function formatHodiny(hodiny: number): string {
  return (Math.round(hodiny * 100) / 100).toLocaleString('cs-CZ');
}

/** Čas v pracovním dni: 8:00 + zlomek × hodDen. */
export function formatCasDne(zlomek: number, hodDen: number): string {
  const minuty = Math.round((ZACATEK_SMENY_HOD + zlomek * hodDen) * 60);
  const h = Math.floor(minuty / 60) % 24;
  const m = minuty % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function formatPracovniCas(cas: PracovniCas | undefined, hodDen: number, vzor = 'd. M.'): string {
  if (!cas) return '—';
  return `${formatDatum(cas.den, vzor)} ${formatCasDne(cas.zlomek, hodDen)}`;
}

export function formatProcenta(podil: number): string {
  return `${Math.round(podil * 100)} %`;
}
