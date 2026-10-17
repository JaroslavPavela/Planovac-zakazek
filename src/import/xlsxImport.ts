// Import zakázek z xlsx podle sekce 2 specifikace. Čistá funkce nad obsahem souboru.

import * as XLSX from 'xlsx';
import { NAVAZUJICI_FAZE, prazdnePoradiFaze } from '../domain/types';
import type { NavazujiciFaze, PoradiFaze, Pripravar, Prirazeni, Zakazka } from '../domain/types';
import { dateNaIso, excelSerialNaIso, textNaIso } from './excelDatum';
import { NAZVY_SLOUPCU, SLOUPEC_PORADI_FAZE, namapujSloupce } from './headers';
import type { KlicSloupce, MapaSloupcu } from './headers';

export interface PreskocenyRadek {
  radek: number; // číslo řádku v Excelu (1 = hlavička)
  duvod: string;
}

export interface VarovaniImportu {
  radek: number;
  cislo: string;
  text: string;
}

export type VysledekImportu =
  | { ok: false; chybejiciSloupce: KlicSloupce[] }
  | {
      ok: true;
      zakazky: Zakazka[];
      prirazeni: Prirazeni[];
      poradiFaze: PoradiFaze; // ruční pořadí front strojů a kompletace (jen přiřazené zakázky)
      preskocene: PreskocenyRadek[];
      varovani: VarovaniImportu[];
      pocetRadku: number; // datové řádky (bez hlavičky a prázdných)
    };

type Bunka = unknown;

function jePrazdna(b: Bunka): boolean {
  return b === null || b === undefined || (typeof b === 'string' && b.trim() === '');
}

function naText(b: Bunka): string {
  if (jePrazdna(b)) return '';
  return String(b).trim();
}

/** Hodiny: číslo, text s desetinnou čárkou, prázdné = 0. Vrací undefined při neplatné hodnotě. */
export function parsujHodiny(b: Bunka): number | undefined {
  if (jePrazdna(b)) return 0;
  let hodnota: number;
  if (typeof b === 'number') {
    hodnota = b;
  } else if (typeof b === 'string') {
    const text = b.replace(/\s/g, '').replace(',', '.');
    if (text === '') return 0;
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) return undefined;
    hodnota = Number(text);
  } else {
    return undefined;
  }
  if (!Number.isFinite(hodnota) || hodnota < 0) return undefined;
  return hodnota;
}

/** Datum: excelové sériové číslo, JS Date nebo text `15.10.2026` / `2026-10-15`. */
export function parsujDatum(b: Bunka): string | undefined {
  if (jePrazdna(b)) return undefined;
  if (typeof b === 'number') return excelSerialNaIso(b);
  if (b instanceof Date) return dateNaIso(b);
  if (typeof b === 'string') {
    const text = b.trim();
    if (/^\d+([.,]\d+)?$/.test(text)) return excelSerialNaIso(Number(text.replace(',', '.')));
    return textNaIso(text);
  }
  return undefined;
}

function parsujPoradi(b: Bunka): number | undefined {
  if (jePrazdna(b)) return undefined;
  const n = typeof b === 'number' ? b : Number(String(b).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

interface RadekPrirazeni {
  zakazkaCislo: string;
  pripravarId: string;
  poradi: number | undefined;
  indexRadku: number;
}

function sestavPrirazeni(radky: RadekPrirazeni[]): Prirazeni[] {
  const podlePripravare = new Map<string, RadekPrirazeni[]>();
  for (const r of radky) {
    const seznam = podlePripravare.get(r.pripravarId) ?? [];
    seznam.push(r);
    podlePripravare.set(r.pripravarId, seznam);
  }
  const vysledek: Prirazeni[] = [];
  for (const [pripravarId, seznam] of podlePripravare) {
    seznam
      .sort((a, b) => (a.poradi ?? Infinity) - (b.poradi ?? Infinity) || a.indexRadku - b.indexRadku)
      .forEach((r, i) => vysledek.push({ zakazkaCislo: r.zakazkaCislo, pripravarId, poradi: i }));
  }
  return vysledek;
}

interface RadekPoradiFaze {
  zakazkaCislo: string;
  poradi: Partial<Record<NavazujiciFaze, number>>;
  indexRadku: number;
}

/** Ruční pořadí front ze sloupců Pořadí Stroj 1–3 / Pořadí kompletace; zakázky bez hodnoty se zařadí podle připravenosti. */
function sestavPoradiFaze(radky: RadekPoradiFaze[]): PoradiFaze {
  const vysledek = prazdnePoradiFaze();
  for (const faze of NAVAZUJICI_FAZE) {
    vysledek[faze] = radky
      .filter((r) => r.poradi[faze] !== undefined)
      .sort((a, b) => a.poradi[faze]! - b.poradi[faze]! || a.indexRadku - b.indexRadku)
      .map((r) => r.zakazkaCislo);
  }
  return vysledek;
}

/**
 * Načte první list sešitu. `pripravari` slouží k obnovení přiřazení podle názvu ve sloupci Přípravář.
 */
export function nactiXlsx(data: ArrayBuffer | Uint8Array, pripravari: Pripravar[] = []): VysledekImportu {
  const sesit = XLSX.read(data, { type: 'array', cellDates: false });
  const nazevListu = sesit.SheetNames[0];
  const list = nazevListu ? sesit.Sheets[nazevListu] : undefined;
  if (!list || !list['!ref']) {
    return { ok: false, chybejiciSloupce: [...namapujSloupce([]).chybejici] };
  }
  const prvniRadek = XLSX.utils.decode_range(list['!ref']).s.r; // 0-based
  const radky = XLSX.utils.sheet_to_json<Bunka[]>(list, { header: 1, raw: true, defval: null, blankrows: false });
  return nactiRadky(radky, pripravari, prvniRadek + 1);
}

/** Zpracuje pole řádků (první = hlavička). Oddělené kvůli testům a opakovanému použití. */
export function nactiRadky(radky: Bunka[][], pripravari: Pripravar[] = [], cisloPrvnihoRadku = 1): VysledekImportu {
  const hlavicka = radky[0] ?? [];
  const { mapa, chybejici } = namapujSloupce(hlavicka);
  if (chybejici.length > 0) return { ok: false, chybejiciSloupce: chybejici };

  const pripravarPodleNazvu = new Map(pripravari.map((p) => [p.nazev.trim().toLowerCase(), p.id]));
  const zakazky: Zakazka[] = [];
  const videnaCisla = new Set<string>();
  const preskocene: PreskocenyRadek[] = [];
  const varovani: VarovaniImportu[] = [];
  const radkyPrirazeni: RadekPrirazeni[] = [];
  const radkyPoradiFaze: RadekPoradiFaze[] = [];
  let pocetRadku = 0;

  const bunka = (radek: Bunka[], klic: KlicSloupce): Bunka => {
    const i = (mapa as MapaSloupcu)[klic];
    return i === undefined ? null : radek[i];
  };

  for (let i = 1; i < radky.length; i++) {
    const radek = radky[i] ?? [];
    if (radek.every(jePrazdna)) continue;
    pocetRadku++;
    const cisloRadku = cisloPrvnihoRadku + i;

    const cislo = naText(bunka(radek, 'cislo zakazky'));
    if (cislo === '') {
      preskocene.push({ radek: cisloRadku, duvod: 'Prázdné číslo zakázky' });
      continue;
    }
    if (videnaCisla.has(cislo)) {
      preskocene.push({ radek: cisloRadku, duvod: `Duplicitní číslo zakázky „${cislo}“` });
      continue;
    }

    const hodiny: Partial<Record<'tpv' | 'stroj 1' | 'stroj 2' | 'stroj 3' | 'kompletace', number>> = {};
    const chybyHodin: string[] = [];
    for (const klic of ['tpv', 'stroj 1', 'stroj 2', 'stroj 3', 'kompletace'] as const) {
      const h = parsujHodiny(bunka(radek, klic));
      if (h === undefined) chybyHodin.push(`${NAZVY_SLOUPCU[klic]}: „${naText(bunka(radek, klic))}“`);
      else hodiny[klic] = h;
    }
    if (chybyHodin.length > 0) {
      preskocene.push({ radek: cisloRadku, duvod: `Neplatné hodiny — ${chybyHodin.join(', ')}` });
      continue;
    }

    const terminZadani = parsujDatum(bunka(radek, 'termin zadani'));
    const terminDokonceni = parsujDatum(bunka(radek, 'termin dokonceni'));
    const chybyDat: string[] = [];
    if (!terminZadani) chybyDat.push(`Termín zadání: „${naText(bunka(radek, 'termin zadani'))}“`);
    if (!terminDokonceni) chybyDat.push(`Termín dokončení: „${naText(bunka(radek, 'termin dokonceni'))}“`);
    if (chybyDat.length > 0) {
      preskocene.push({ radek: cisloRadku, duvod: `Neplatné datum — ${chybyDat.join(', ')}` });
      continue;
    }

    if (terminDokonceni! < terminZadani!) {
      varovani.push({ radek: cisloRadku, cislo, text: 'Termín dokončení je dřív než termín zadání' });
    }

    videnaCisla.add(cislo);
    zakazky.push({
      cislo,
      nazev: naText(bunka(radek, 'nazev')),
      firma: naText(bunka(radek, 'firma')),
      tpvHod: hodiny.tpv!,
      stroj1Hod: hodiny['stroj 1']!,
      stroj2Hod: hodiny['stroj 2']!,
      stroj3Hod: hodiny['stroj 3']!,
      kompletaceHod: hodiny.kompletace!,
      terminZadani: terminZadani!,
      terminDokonceni: terminDokonceni!,
    });

    const nazevPripravare = naText(bunka(radek, 'pripravar'));
    if (nazevPripravare !== '') {
      const pripravarId = pripravarPodleNazvu.get(nazevPripravare.toLowerCase());
      if (pripravarId) {
        radkyPrirazeni.push({ zakazkaCislo: cislo, pripravarId, poradi: parsujPoradi(bunka(radek, 'poradi')), indexRadku: i });
        const poradi: RadekPoradiFaze['poradi'] = {};
        for (const faze of NAVAZUJICI_FAZE) poradi[faze] = parsujPoradi(bunka(radek, SLOUPEC_PORADI_FAZE[faze]));
        radkyPoradiFaze.push({ zakazkaCislo: cislo, poradi, indexRadku: i });
      } else {
        varovani.push({ radek: cisloRadku, cislo, text: `Přípravář „${nazevPripravare}“ není v nastavení — zakázka je v zásobníku` });
      }
    }
  }

  return {
    ok: true,
    zakazky,
    prirazeni: sestavPrirazeni(radkyPrirazeni),
    poradiFaze: sestavPoradiFaze(radkyPoradiFaze),
    preskocene,
    varovani,
    pocetRadku,
  };
}
