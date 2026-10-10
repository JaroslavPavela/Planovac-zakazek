// Pracovní kalendář podle sekce 4 specifikace.
// Data jsou ISO 'YYYY-MM-DD', počítá se v UTC, aby výsledek nezávisel na časové zóně.

import type { PracovniCas } from './types';

const DEN_MS = 86_400_000;
const EPS = 1e-9;

// ---------- základní práce s datem ----------

function zIso(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Neplatné ISO datum: "${iso}"`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(ms)) throw new Error(`Neplatné ISO datum: "${iso}"`);
  return ms;
}

function naIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function iso(rok: number, mesic: number, den: number): string {
  return naIso(Date.UTC(rok, mesic - 1, den));
}

export function pridejDny(isoDatum: string, pocet: number): string {
  return naIso(zIso(isoDatum) + pocet * DEN_MS);
}

/** Den v týdnu: 1 = pondělí … 7 = neděle. */
export function denVTydnu(isoDatum: string): number {
  const d = new Date(zIso(isoDatum)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function rokZIso(isoDatum: string): number {
  return Number(isoDatum.slice(0, 4));
}

/** Rozdíl b − a v kalendářních dnech. */
export function rozdilDnu(a: string, b: string): number {
  return Math.round((zIso(b) - zIso(a)) / DEN_MS);
}

// ---------- svátky ----------

/** Velikonoční neděle (gregoriánský algoritmus, Meeus/Jones/Butcher). */
export function velikonocniNedele(rok: number): string {
  const a = rok % 19;
  const b = Math.floor(rok / 100);
  const c = rok % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesic = Math.floor((h + l - 7 * m + 114) / 31);
  const den = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(rok, mesic, den);
}

const svatkyCache = new Map<number, Set<string>>();

/** České státní svátky v daném roce (seřazené ISO datumy). */
export function svatky(rok: number): string[] {
  return [...svatkyMnozina(rok)].sort();
}

function svatkyMnozina(rok: number): Set<string> {
  let s = svatkyCache.get(rok);
  if (!s) {
    const velikonoce = velikonocniNedele(rok);
    s = new Set([
      iso(rok, 1, 1),
      pridejDny(velikonoce, -2), // Velký pátek
      pridejDny(velikonoce, 1), // Velikonoční pondělí
      iso(rok, 5, 1),
      iso(rok, 5, 8),
      iso(rok, 7, 5),
      iso(rok, 7, 6),
      iso(rok, 9, 28),
      iso(rok, 10, 28),
      iso(rok, 11, 17),
      iso(rok, 12, 24),
      iso(rok, 12, 25),
      iso(rok, 12, 26),
    ]);
    svatkyCache.set(rok, s);
  }
  return s;
}

export function jeSvatek(isoDatum: string): boolean {
  return svatkyMnozina(rokZIso(isoDatum)).has(isoDatum);
}

export function jeVikend(isoDatum: string): boolean {
  return denVTydnu(isoDatum) >= 6;
}

export function jePracovniDen(isoDatum: string): boolean {
  return !jeVikend(isoDatum) && !jeSvatek(isoDatum);
}

// ---------- posuny po pracovních dnech ----------

/** Nejbližší pracovní den ostře po daném dni. */
export function dalsiPracovniDen(isoDatum: string): string {
  let d = pridejDny(isoDatum, 1);
  while (!jePracovniDen(d)) d = pridejDny(d, 1);
  return d;
}

/** Nejbližší pracovní den ostře před daným dnem. */
export function predchoziPracovniDen(isoDatum: string): string {
  let d = pridejDny(isoDatum, -1);
  while (!jePracovniDen(d)) d = pridejDny(d, -1);
  return d;
}

/** Daný den, pokud je pracovní; jinak nejbližší následující pracovní den. */
export function naPracovniDen(isoDatum: string): string {
  return jePracovniDen(isoDatum) ? isoDatum : dalsiPracovniDen(isoDatum);
}

/** Daný den, pokud je pracovní; jinak nejbližší předchozí pracovní den. */
export function naPracovniDenZpet(isoDatum: string): string {
  return jePracovniDen(isoDatum) ? isoDatum : predchoziPracovniDen(isoDatum);
}

/** Posun o n pracovních dnů (n < 0 = zpět). Výchozí den nemusí být pracovní. */
export function posunPracovniDny(isoDatum: string, n: number): string {
  let d = isoDatum;
  for (let i = 0; i < Math.abs(n); i++) {
    d = n > 0 ? dalsiPracovniDen(d) : predchoziPracovniDen(d);
  }
  return d;
}

/** Počet pracovních dnů v intervalu <od, do> včetně obou mezí. */
export function pocetPracovnichDnu(od: string, doDne: string): number {
  let pocet = 0;
  for (let d = od; d <= doDne; d = pridejDny(d, 1)) {
    if (jePracovniDen(d)) pocet++;
  }
  return pocet;
}

// ---------- pracovní čas ----------

function zaokrouhli(zlomek: number): number {
  return Math.round(zlomek * 1e6) / 1e6;
}

/** Normalizace pro začátek práce: nepracovní den → další pracovní den; konec dne (zlomek 1) → začátek dalšího dne. */
function zacatekPrace(cas: PracovniCas): PracovniCas {
  if (!jePracovniDen(cas.den)) return { den: naPracovniDen(cas.den), zlomek: 0 };
  if (cas.zlomek >= 1 - EPS) return { den: dalsiPracovniDen(cas.den), zlomek: 0 };
  return cas;
}

/** Normalizace pro konec práce (zpětný výpočet): nepracovní den → konec předchozího pracovního dne; zlomek 0 → konec předchozího dne. */
function konecPrace(cas: PracovniCas): PracovniCas {
  if (!jePracovniDen(cas.den)) return { den: naPracovniDenZpet(cas.den), zlomek: 1 };
  if (cas.zlomek <= EPS) return { den: predchoziPracovniDen(cas.den), zlomek: 1 };
  return cas;
}

/**
 * Přičte hodiny práce při kapacitě hodDen hodin/den; postupuje po pracovních dnech.
 * Konec může být `{den, zlomek: 1}` (= konec dne). 0 hodin → vrací start beze změny.
 */
export function pridejHodiny(start: PracovniCas, hodiny: number, hodDen: number): PracovniCas {
  if (hodiny <= 0) return start;
  if (hodDen <= 0) throw new Error('Hodiny/den musí být kladné.');
  let zbyva = hodiny / hodDen;
  let { den, zlomek } = zacatekPrace(start);
  for (;;) {
    const volne = 1 - zlomek;
    if (zbyva <= volne + EPS) {
      return { den, zlomek: zaokrouhli(Math.min(1, zlomek + zbyva)) };
    }
    zbyva -= volne;
    den = dalsiPracovniDen(den);
    zlomek = 0;
  }
}

/** Odečte hodiny práce zpětně od konce (inverze k pridejHodiny). 0 hodin → vrací konec beze změny. */
export function odectiHodiny(konec: PracovniCas, hodiny: number, hodDen: number): PracovniCas {
  if (hodiny <= 0) return konec;
  if (hodDen <= 0) throw new Error('Hodiny/den musí být kladné.');
  let zbyva = hodiny / hodDen;
  let { den, zlomek } = konecPrace(konec);
  for (;;) {
    if (zbyva <= zlomek + EPS) {
      return { den, zlomek: zaokrouhli(Math.max(0, zlomek - zbyva)) };
    }
    zbyva -= zlomek;
    den = predchoziPracovniDen(den);
    zlomek = 1;
  }
}

/** Porovnání: záporné = a < b, 0 = shodné, kladné = a > b. Porovnává nejdřív den, pak zlomek. */
export function porovnej(a: PracovniCas, b: PracovniCas): number {
  if (a.den !== b.den) return a.den < b.den ? -1 : 1;
  if (Math.abs(a.zlomek - b.zlomek) <= EPS) return 0;
  return a.zlomek < b.zlomek ? -1 : 1;
}

export function max(a: PracovniCas, b: PracovniCas): PracovniCas {
  return porovnej(a, b) >= 0 ? a : b;
}

export function min(a: PracovniCas, b: PracovniCas): PracovniCas {
  return porovnej(a, b) <= 0 ? a : b;
}

// ---------- ISO týdny ----------

/** ISO týden ve tvaru '2026-W42'. */
export function isoTyden(isoDatum: string): string {
  // čtvrtek téhož ISO týdne určuje rok
  const ctvrtek = pridejDny(isoDatum, 4 - denVTydnu(isoDatum));
  const rok = rokZIso(ctvrtek);
  const prvniLeden = iso(rok, 1, 1);
  const cislo = Math.floor(rozdilDnu(prvniLeden, ctvrtek) / 7) + 1;
  return `${rok}-W${String(cislo).padStart(2, '0')}`;
}

/** Pondělí daného ISO týdne ('2026-W42' → '2026-10-12'). */
export function pondeliTydne(tyden: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(tyden);
  if (!m) throw new Error(`Neplatný ISO týden: "${tyden}"`);
  const rok = Number(m[1]);
  const cislo = Number(m[2]);
  const ctvrtyLeden = iso(rok, 1, 4); // vždy v 1. ISO týdnu
  const pondeliPrvniho = pridejDny(ctvrtyLeden, 1 - denVTydnu(ctvrtyLeden));
  return pridejDny(pondeliPrvniho, (cislo - 1) * 7);
}

/** Pracovní dny v daném ISO týdnu (ISO datumy). */
export function pracovniDnyVTydnu(tyden: string): string[] {
  const pondeli = pondeliTydne(tyden);
  const dny: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = pridejDny(pondeli, i);
    if (jePracovniDen(d)) dny.push(d);
  }
  return dny;
}
